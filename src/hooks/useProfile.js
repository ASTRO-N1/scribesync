// src/hooks/useProfile.js
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULTS } from '../constants';

const LOCAL_STORAGE_PROFILE_KEY = 'scribsync_adaptive_profile_v2';

export const INITIAL_DEFAULT_PROFILE = {
  is_calibrated: false,
  handwriting_wpm: DEFAULTS.HANDWRITING_WPM,
  ms_per_char: DEFAULTS.MS_PER_CHAR,
  complexity_sensitivity: DEFAULTS.COMPLEXITY_SENSITIVITY,

  easy_chunk_capacity: DEFAULTS.EASY_CHUNK_CAPACITY,
  medium_chunk_capacity: DEFAULTS.MEDIUM_CHUNK_CAPACITY,
  hard_chunk_capacity: DEFAULTS.HARD_CHUNK_CAPACITY,

  avg_pause_duration: DEFAULTS.PAUSE_DURATION,
  speaking_speed: DEFAULTS.SPEAKING_SPEED,
  preferred_mode: DEFAULTS.MODE,
  preferred_voice: DEFAULTS.VOICE,

  total_sessions: 0,
  total_chunks_practiced: 0,
  total_words_practiced: 0,
  replay_rate: 0.0,
  updated_at: new Date().toISOString(),
};

export function useProfile(user) {
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (stored) {
        return { ...INITIAL_DEFAULT_PROFILE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse profile from localStorage', e);
    }
    return INITIAL_DEFAULT_PROFILE;
  });

  const [loading, setLoading] = useState(false);

  // Sync with Supabase when authenticated
  useEffect(() => {
    if (!user || !supabase || !isSupabaseConfigured) return;

    async function loadCloudProfile() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('pacing_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Supabase profile load notice:', error.message);
        }

        if (data) {
          setProfile(prev => {
            const merged = { ...prev, ...data };
            localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(merged));
            return merged;
          });
        } else {
          // Upload local profile to Supabase
          await supabase
            .from('pacing_profiles')
            .upsert({ ...profile, user_id: user.id });
        }
      } catch (err) {
        console.error('Failed to sync profile with Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCloudProfile();
  }, [user]);

  const saveProfile = useCallback(async (newProfile) => {
    const updated = {
      ...newProfile,
      updated_at: new Date().toISOString(),
    };
    setProfile(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save profile to localStorage:', err);
    }

    if (user && supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('pacing_profiles')
          .upsert({ ...updated, user_id: user.id });
      } catch (err) {
        console.warn('Cloud profile save failed, cached locally:', err);
      }
    }
  }, [user]);

  const resetCalibration = useCallback(() => {
    const reset = {
      ...INITIAL_DEFAULT_PROFILE,
      preferred_voice: profile.preferred_voice,
    };
    saveProfile(reset);
  }, [profile.preferred_voice, saveProfile]);

  return {
    profile,
    loading,
    saveProfile,
    resetCalibration,
  };
}
