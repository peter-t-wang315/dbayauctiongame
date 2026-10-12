'use client';
// Side-effect import from JoinForm: the Join tap unlocks Web Audio (only when sound is on).
import { registerAudioUnlock } from '../../components/shell/audioUnlock';
import { unlockAudio } from './audio';

registerAudioUnlock(unlockAudio);
