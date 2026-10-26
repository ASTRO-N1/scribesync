// src/lib/mathSpeechNormalizer.js

/**
 * Unicode Subscript map for clean visual display
 */
const SUBSCRIPT_MAP = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'n': 'ₙ', 'm': 'ₘ',
};

const SUPERSCRIPT_MAP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', '+': '⁺', '-': '⁻',
};

/**
 * Checks if a text contains mathematical, LaTeX, or STEM notations.
 */
export function hasMathContent(text) {
  if (!text) return false;
  return (
    /\\\[|\\\]|\\\(|\\\)|\\begin|\\end|\$\$|\$|\\neq|\\in|\\ldots|\\frac|\\sqrt|_\{?\d+\}?|\^\{?\d+\}?|[=≠≤≥∈∉±×÷√∑∏]/.test(text) ||
    /^[#\s]*\d+\s*\n[#\s]*\+\s*\d+\s*\n[#\s]*\d+/m.test(text) ||
    /[A-Z]\s*\+\s*[A-Z]\s*=\s*[A-Z]/.test(text) ||
    /\bCSP\b/.test(text)
  );
}

/**
 * Formats cryptarithmetic LaTeX array into clean visual grid and phonetic dictation
 * e.g. \begin{array}{rrrrr} &&S&E&N&D\\ +&&M&O&R&E\\ \hline &M&O&N&E&Y \end{array}
 */
export function parseCryptarithmeticArray(latexArray) {
  // Extract content inside \begin{array}... and \end{array}
  const cleanBody = latexArray
    .replace(/^.*?\\begin\{array\}\{[^}]*\}/s, '')
    .replace(/\\end\{array\}.*$/s, '')
    .trim();

  // Split rows by \\ (handles both \\ and \\\\)
  const rawRows = cleanBody.split(/\\\\+/).map(r => r.trim()).filter(Boolean);
  const rows = [];

  for (const rawRow of rawRows) {
    if (rawRow.includes('\\hline') && !/[A-Za-z0-9]/.test(rawRow)) {
      continue;
    }
    // Clean row cells separated by &
    const cells = rawRow
      .replace(/\\hline/g, '')
      .split('&')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const rowStr = cells.join('');
    if (rowStr.startsWith('+')) {
      rows.push({ isOperator: true, text: rowStr.replace(/^\+/, '').trim() });
    } else if (rowStr.length > 0) {
      rows.push({ isOperator: false, text: rowStr.trim() });
    }
  }

  if (rows.length >= 3) {
    const topWord = rows[0].text;
    const bottomWord = rows[1].text;
    const resultWord = rows[2].text;

    const maxLen = Math.max(topWord.length, bottomWord.length + 2, resultWord.length);
    const displayTop = topWord.padStart(maxLen, ' ');
    const displayBottom = ('+ ' + bottomWord).padStart(maxLen, ' ');
    const displayLine = '-'.repeat(maxLen);
    const displayResult = resultWord.padStart(maxLen, ' ');

    const displayText = `${displayTop}\n${displayBottom}\n${displayLine}\n${displayResult}`;

    // Spell out letters with pauses so user can write each letter down!
    const spellLetters = (word) => word.split('').join(', ');
    const spokenText = `Column addition: ${spellLetters(topWord)}, plus, ${spellLetters(bottomWord)}, gives, ${spellLetters(resultWord)}.`;

    return { displayText, spokenText, isCryptarithmetic: true };
  }

  return null;
}

/**
 * Normalizes an aligned solution block like:
 * \begin{aligned} S&=9, & E&=5,\\ N&=6, & D&=7,\\ M&=1, & O&=0,\\ R&=8, & Y&=2 \end{aligned}
 */
export function parseAlignedEquations(latexBlock) {
  const clean = latexBlock
    .replace(/^.*?\\begin\{aligned\}/s, '')
    .replace(/\\end\{aligned\}.*$/s, '')
    .replace(/\\\\+/g, ', ')
    .replace(/&/g, ' ')
    .trim();

  const pairs = clean.split(',').map(p => p.trim()).filter(Boolean);
  const cleanPairs = pairs.map(p => {
    return p.replace(/([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)/, '$1 = $2');
  });

  const displayText = cleanPairs.join(', ');
  const spokenText = cleanPairs
    .map(p => p.replace('=', 'equals'))
    .join('; ');

  return { displayText, spokenText };
}

/**
 * Normalizes an individual mathematical expression or formula.
 */
export function normalizeMathExpression(rawExpr) {
  let display = rawExpr.trim();
  let spoken = rawExpr.trim();

  // Strip LaTeX wrapping
  display = display
    .replace(/^\\\[\s*/, '')
    .replace(/\s*\\\]$/, '')
    .replace(/^\\\(\s*/, '')
    .replace(/\s*\\\)$/, '')
    .replace(/^\$\$\s*/, '')
    .replace(/\s*\$\$$/, '')
    .replace(/^\$\s*/, '')
    .replace(/\s*\$$/, '');

  spoken = display;

  // Fractions: \frac{a}{b}
  display = display.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  spoken = spoken.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' $1 over $2 ');

  // Square roots: \sqrt{x}
  display = display.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  spoken = spoken.replace(/\\sqrt\{([^}]+)\}/g, ' square root of $1 ');

  // Subscripts: C_1, C_2, 10C_1 -> display "C₁", "10C₁", spoken "C 1", "10 C 1"
  spoken = spoken.replace(/(\d+)([A-Za-z])_\{?(\d+|[a-z])\}?/g, '$1 $2 $3');
  spoken = spoken.replace(/([A-Za-z])_\{?(\d+|[a-z])\}?/g, '$1 $2');
  display = display.replace(/([A-Za-z])_\{?(\d+|[a-z])\}?/g, (match, letter, sub) => {
    const unicodeSub = sub.split('').map(ch => SUBSCRIPT_MAP[ch] || ch).join('');
    return `${letter}${unicodeSub}`;
  });

  // Superscripts: x^2, x^3
  spoken = spoken.replace(/([A-Za-z0-9])\^2\b/g, '$1 squared');
  spoken = spoken.replace(/([A-Za-z0-9])\^3\b/g, '$1 cubed');
  spoken = spoken.replace(/([A-Za-z0-9])\^\{?([^}]+)\}?/g, '$1 to the power $2');
  display = display.replace(/([A-Za-z0-9])\^\{?([^}]+)\}?/g, (match, base, sup) => {
    const unicodeSup = sup.split('').map(ch => SUPERSCRIPT_MAP[ch] || ch).join('');
    return `${base}${unicodeSup}`;
  });

  // Comparisons & Symbols
  display = display
    .replace(/\\neq|\\ne/g, '≠')
    .replace(/\\leq|\\le/g, '≤')
    .replace(/\\geq|\\ge/g, '≥')
    .replace(/\\approx/g, '≈')
    .replace(/\\equiv/g, '≡')
    .replace(/\\notin/g, '∉')
    .replace(/\\in/g, '∈')
    .replace(/\\subset/g, '⊂')
    .replace(/\\subseteq/g, '⊆')
    .replace(/\\cup/g, '∪')
    .replace(/\\cap/g, '∩')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\ldots|\\dots|\\cdots/g, '...')
    .replace(/\\to|\\rightarrow/g, '→')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\infty/g, '∞')
    .replace(/\\forall/g, '∀')
    .replace(/\\exists/g, '∃');

  // Spoken conversions
  spoken = spoken
    .replace(/\\neq|\\ne|≠/g, ' is not equal to ')
    .replace(/\\leq|\\le|≤/g, ' is less than or equal to ')
    .replace(/\\geq|\\ge|≥/g, ' is greater than or equal to ')
    .replace(/\\approx|≈/g, ' is approximately ')
    .replace(/\\equiv|≡/g, ' is equivalent to ')
    .replace(/\\notin|∉/g, ' is not in the set ')
    .replace(/\\in|∈/g, ' in the set ')
    .replace(/\\subset|⊂/g, ' subset of ')
    .replace(/\\subseteq|⊆/g, ' subset of or equal to ')
    .replace(/\\cup|∪/g, ' union ')
    .replace(/\\cap|∩/g, ' intersection ')
    .replace(/\\pm|±/g, ' plus or minus ')
    .replace(/\\times|×/g, ' times ')
    .replace(/\\div|÷/g, ' divided by ')
    .replace(/\\cdot|·/g, ' dot ')
    .replace(/\\ldots|\\dots|\\cdots|\.{3,}|…/g, ' through ')
    .replace(/\\to|\\rightarrow|→/g, ' leads to ')
    .replace(/\\Rightarrow|⇒/g, ' implies ')
    .replace(/\\infty|∞/g, ' infinity ')
    .replace(/\\forall|∀/g, ' for all ')
    .replace(/\\exists|∃/g, ' there exists ');

  // Clean curly braces: \{0,1,\ldots,9\} -> display "{0, 1, ..., 9}", spoken "in the set 0, 1 through 9"
  display = display.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  spoken = spoken.replace(/\\\{/g, ' ').replace(/\\\}/g, ' ');
  spoken = spoken.replace(/\s*,\s*through\s*,?\s*/g, ' through ');
  spoken = spoken.replace(/\bin the set\s+set\b/g, 'in the set');
  spoken = spoken.replace(/\{\s*([^}]+)\s*\}/g, 'set $1');

  // Spoken arithmetic operators (preserve hyphenated English words like 'column-wise')
  spoken = spoken
    .replace(/\s*=\s*/g, ' equals ')
    .replace(/\s*\+\s*/g, ' plus ')
    .replace(/(\s+-\s+|(?<=[A-Za-z0-9_])\s*-\s*(?=[0-9]))/g, ' minus ')
    .replace(/\s*\*\s*/g, ' times ');

  // Add clean visual spacing around operators in display math
  display = display
    .replace(/([A-Za-z0-9_₀-₉])\s*=\s*([A-Za-z0-9_₀-₉])/g, '$1 = $2')
    .replace(/([A-Za-z0-9_₀-₉])\s*\+\s*([A-Za-z0-9_₀-₉])/g, '$1 + $2')
    .replace(/([A-Za-z0-9_₀-₉])\s*-\s*([A-Za-z0-9_₀-₉])/g, '$1 - $2');

  // Spoken cryptarithmetic acronyms when in equations
  spoken = spoken.replace(/\b(SEND)\b/g, 'S, E, N, D');
  spoken = spoken.replace(/\b(MORE)\b/g, 'M, O, R, E');
  spoken = spoken.replace(/\b(MONEY)\b/g, 'M, O, N, E, Y');

  // Format numbers for speech (e.g. 9567 -> 9,567)
  spoken = spoken.replace(/\b(\d{4,})\b/g, (num) => Number(num).toLocaleString('en-US'));

  display = display.replace(/\s+/g, ' ').trim();
  spoken = spoken.replace(/\s+/g, ' ').trim();

  return { displayText: display, spokenText: spoken };
}

/**
 * Normalizes Markdown headings and formatting:
 * "## Q2. Formulate and solve..." ->
 *   Display: "Q2. Formulate and solve..."
 *   Spoken: "Question 2: Formulate and solve..."
 */
export function normalizeMarkdownHeader(line) {
  const trimmed = line.trim();
  const headerMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
  if (!headerMatch) return null;

  const content = headerMatch[2].trim();

  // "Q2. Formulate..."
  const qMatch = content.match(/^Q(\d+)\.?\s*(.*)$/i);
  if (qMatch) {
    const qNum = qMatch[1];
    const qRest = qMatch[2];
    const restNorm = normalizeSentenceContent(qRest);
    return {
      displayText: `Q${qNum}. ${restNorm.displayText}`.trim(),
      spokenText: `Question ${qNum}: ${restNorm.spokenText}`.trim(),
      isHeader: true,
    };
  }

  // "1. Introduction" or "2. Formulation as a CSP"
  const secMatch = content.match(/^(\d+)\.\s*(.*)$/);
  if (secMatch) {
    const secNum = secMatch[1];
    const secTitle = secMatch[2];
    const titleNorm = normalizeSentenceContent(secTitle);
    return {
      displayText: `${secNum}. ${titleNorm.displayText}`.trim(),
      spokenText: `Section ${secNum}: ${titleNorm.spokenText}`.trim(),
      isHeader: true,
    };
  }

  const norm = normalizeSentenceContent(content);
  return {
    displayText: norm.displayText,
    spokenText: norm.spokenText,
    isHeader: true,
  };
}

/**
 * Detects ASCII-style addition blocks like:
 * # 9567
 * # + 1085
 * # 10652
 */
export function parseAsciiAdditionBlock(text) {
  const match = text.match(/^[#\s]*(\d+)\s*\n[#\s]*\+\s*(\d+)\s*\n[#\s]*(\d+)/m);
  if (match) {
    const n1 = match[1];
    const n2 = match[2];
    const sum = match[3];

    const maxLen = Math.max(n1.length, n2.length + 2, sum.length);
    const displayText = `  ${n1.padStart(maxLen - 2)}\n+ ${n2.padStart(maxLen - 2)}\n${'-'.repeat(maxLen)}\n  ${sum.padStart(maxLen - 2)}`;
    const spokenText = `Column addition: ${Number(n1).toLocaleString()}, plus ${Number(n2).toLocaleString()}, equals ${Number(sum).toLocaleString()}.`;

    return { displayText, spokenText, isMathBlock: true };
  }
  return null;
}

/**
 * Normalizes an inline sentence or clause containing markdown or inline math \( ... \)
 */
export function normalizeSentenceContent(rawSentence) {
  let display = rawSentence;
  let spoken = rawSentence;

  // 1. Expand acronym "CSP" for phonetic clarity
  spoken = spoken.replace(/\bCSP\b/g, 'C S P');

  // 2. Normalize inline math \( ... \) or $ ... $
  const inlineMathRegex = /\\\((.*?)\\\)|\$([^\$]+)\$/g;
  let match;

  while ((match = inlineMathRegex.exec(rawSentence)) !== null) {
    const fullMatch = match[0];
    const mathContent = match[1] || match[2];
    const norm = normalizeMathExpression(mathContent);

    display = display.replace(fullMatch, norm.displayText);
    spoken = spoken.replace(fullMatch, norm.spokenText);
  }

  // 3. Normalize standalone math symbols if any remain
  const generalNorm = normalizeMathExpression(display);
  display = generalNorm.displayText;
  spoken = generalNorm.spokenText;

  // Clean Markdown bold/italics markers
  display = display.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
  spoken = spoken.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

  // Clean Markdown hashes on random lines
  display = display.replace(/^#+\s*/, '');
  spoken = spoken.replace(/^#+\s*/, '');

  return { displayText: display, spokenText: spoken };
}

/**
 * Detects if a text block represents a Markdown table.
 */
export function isMarkdownTable(block) {
  if (!block) return false;
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  // Second line must be a markdown separator line, e.g. | --- | --- | or --- | ---
  const separatorRegex = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
  return separatorRegex.test(lines[1]);
}

/**
 * Parses a Markdown comparison table into dictation-ready segments:
 * 1. Intro segment: announcing columns & row count.
 * 2. Per-row, per-column segments with explicit verbal cues:
 *    "Row 1, under Go-Back-N: Retransmits the erroneous frame and subsequent frames."
 *    "Under Selective Repeat: Retransmits only lost or damaged frames."
 */
export function parseMarkdownTable(block) {
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // 1. Header row
  const headerCells = lines[0]
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim())
    .filter(Boolean);

  if (headerCells.length < 2) return null;

  // 2. Data rows
  const dataRows = [];
  for (let r = 2; r < lines.length; r++) {
    // skip stray separator lines if any
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[r])) continue;

    const cells = lines[r]
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());

    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      dataRows.push(cells);
    }
  }

  if (dataRows.length === 0) return null;

  const segments = [];
  const totalRows = dataRows.length;
  const totalCols = headerCells.length;

  // 3. Table Intro segment
  const tableTitle = headerCells.join(' vs ');
  const introDisplay = `Comparison Table: ${tableTitle}\n(${totalRows} rows, ${totalCols} columns)`;
  const introSpoken = `Comparison table with ${totalCols} columns: ${headerCells.map((h, i) => `Column ${i + 1} is ${h}`).join('. ')}.`;

  segments.push({
    rawText: lines.slice(0, 2).join('\n'),
    displayText: introDisplay,
    spokenText: introSpoken,
    isTableIntro: true,
    isBlock: true,
    tableHeaders: headerCells,
    totalRows,
    totalCols,
  });

  // Check if column 0 is a parameter/feature label (e.g. "Feature", "Parameter", "Basis", "Property")
  const firstHeaderLower = headerCells[0].toLowerCase();
  const hasFeatureCol = totalCols >= 3 && /feature|parameter|basis|property|criterion|attribute|aspect/i.test(firstHeaderLower);

  // 4. Generate cell-by-cell segments
  dataRows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 1;
    const featureName = hasFeatureCol ? row[0] : null;
    const startCol = hasFeatureCol ? 1 : 0;

    for (let colIdx = startCol; colIdx < totalCols; colIdx++) {
      const colHeader = headerCells[colIdx];
      const cellValue = row[colIdx] || '';

      let cellSpoken = '';
      if (hasFeatureCol) {
        if (colIdx === startCol) {
          cellSpoken = `Row ${rowNum}, for ${featureName}. Under ${colHeader}: ${cellValue}`;
        } else {
          cellSpoken = `Under ${colHeader}: ${cellValue}`;
        }
      } else {
        if (colIdx === 0) {
          cellSpoken = `Row ${rowNum}, under ${colHeader}: ${cellValue}`;
        } else {
          cellSpoken = `Under ${colHeader}: ${cellValue}`;
        }
      }

      const cellDisplay = `[${colHeader}]\n${cellValue}`;

      segments.push({
        rawText: `Row ${rowNum} | ${colHeader} | ${cellValue}`,
        displayText: cellDisplay,
        spokenText: cellSpoken,
        isTableCell: true,
        rowNumber: rowNum,
        totalRows,
        columnHeader: colHeader,
        columnIndex: colIdx,
        totalColumns: totalCols,
        cellText: cellValue,
        fullRow: row,
        tableHeaders: headerCells,
      });
    }
  });

  return segments;
}

/**
 * Pre-processes an entire raw text document (with LaTeX, Markdown, Math)
 * into structured logical sentences/blocks ready for chunking and dictation.
 */
export function preprocessTextForDictation(rawText) {
  if (!rawText || !rawText.trim()) return [];

  // Normalize newlines
  const text = rawText.replace(/\r\n/g, '\n');

  // Split into paragraphs / top-level blocks
  const blocks = text.split(/\n{2,}/);
  const processedSegments = [];

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // A. Check Markdown Comparison Table
    if (isMarkdownTable(trimmedBlock)) {
      const tableSegments = parseMarkdownTable(trimmedBlock);
      if (tableSegments && tableSegments.length > 0) {
        processedSegments.push(...tableSegments);
        continue;
      }
    }

    // B. Check ASCII addition block
    const asciiBlock = parseAsciiAdditionBlock(trimmedBlock);
    if (asciiBlock) {
      processedSegments.push({
        rawText: trimmedBlock,
        displayText: asciiBlock.displayText,
        spokenText: asciiBlock.spokenText,
        hasMath: true,
        isBlock: true,
      });
      continue;
    }

    // B. Check LaTeX array / cryptarithmetic block (display math \[ ... \])
    if (/\\begin\{array\}/.test(trimmedBlock)) {
      const crypto = parseCryptarithmeticArray(trimmedBlock);
      if (crypto) {
        processedSegments.push({
          rawText: trimmedBlock,
          displayText: crypto.displayText,
          spokenText: crypto.spokenText,
          hasMath: true,
          isBlock: true,
        });
        continue;
      }
    }

    // C. Check aligned equations block
    if (/\\begin\{aligned\}/.test(trimmedBlock)) {
      const aligned = parseAlignedEquations(trimmedBlock);
      processedSegments.push({
        rawText: trimmedBlock,
        displayText: aligned.displayText,
        spokenText: aligned.spokenText,
        hasMath: true,
        isBlock: true,
      });
      continue;
    }

    // D. Check display equation \[ ... \] or $$ ... $$
    if (/^\\\[[\s\S]*\\\]$/.test(trimmedBlock) || /^\$\$[\s\S]*\$\$$/.test(trimmedBlock)) {
      const norm = normalizeMathExpression(trimmedBlock);
      processedSegments.push({
        rawText: trimmedBlock,
        displayText: norm.displayText,
        spokenText: norm.spokenText,
        hasMath: true,
        isEquation: true,
      });
      continue;
    }

    // E. Check Markdown Header line
    if (/^#{1,6}\s+/.test(trimmedBlock)) {
      const lines = trimmedBlock.split('\n');
      for (const line of lines) {
        const header = normalizeMarkdownHeader(line);
        if (header) {
          processedSegments.push({
            rawText: line,
            displayText: header.displayText,
            spokenText: header.spokenText,
            isHeader: true,
            hasMath: hasMathContent(header.displayText),
          });
        }
      }
      continue;
    }

    // F. Line-by-line inspection for display equations, lists, and prose
    const lines = trimmedBlock.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Standalone display equation on a single line
      if (/^\\\[[\s\S]*\\\]$/.test(line) || /^\$\$[\s\S]*\$\$$/.test(line)) {
        if (/\\begin\{array\}/.test(line)) {
          const crypto = parseCryptarithmeticArray(line);
          if (crypto) {
            processedSegments.push({
              rawText: line,
              displayText: crypto.displayText,
              spokenText: crypto.spokenText,
              hasMath: true,
              isBlock: true,
            });
            continue;
          }
        }
        if (/\\begin\{aligned\}/.test(line)) {
          const aligned = parseAlignedEquations(line);
          processedSegments.push({
            rawText: line,
            displayText: aligned.displayText,
            spokenText: aligned.spokenText,
            hasMath: true,
            isBlock: true,
          });
          continue;
        }

        const norm = normalizeMathExpression(line);
        processedSegments.push({
          rawText: line,
          displayText: norm.displayText,
          spokenText: norm.spokenText,
          hasMath: true,
          isEquation: true,
        });
        continue;
      }

      // Standalone header on a line
      if (/^#{1,6}\s+/.test(line)) {
        const header = normalizeMarkdownHeader(line);
        if (header) {
          processedSegments.push({
            rawText: line,
            displayText: header.displayText,
            spokenText: header.spokenText,
            isHeader: true,
            hasMath: hasMathContent(header.displayText),
          });
          continue;
        }
      }

      // Numbered list item "1. All letters...", "2. S \neq 0..."
      const listMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (listMatch) {
        const num = listMatch[1];
        const itemContent = listMatch[2];
        const norm = normalizeSentenceContent(itemContent);
        processedSegments.push({
          rawText: line,
          displayText: `${num}. ${norm.displayText}`,
          spokenText: `Point ${num}: ${norm.spokenText}`,
          hasMath: hasMathContent(itemContent),
          isListItem: true,
        });
        continue;
      }

      // Standalone label like "Units column:", "Tens column:", "Constraints:"
      if (/^[A-Za-z\s]+:$/.test(line)) {
        processedSegments.push({
          rawText: line,
          displayText: line,
          spokenText: line,
          isLabel: true,
        });
        continue;
      }

      // Standard prose sentence with potential inline math
      const norm = normalizeSentenceContent(line);
      processedSegments.push({
        rawText: line,
        displayText: norm.displayText,
        spokenText: norm.spokenText,
        hasMath: hasMathContent(line),
      });
    }
  }

  return processedSegments;
}
