import { useEffect, useReducer } from 'react';
import { BEATS, beatIndex, initialLotState, lotReducer } from './lotTimeline';

// Drives the Live Lot story. While `playing`, each beat advances after its
// duration. When not playing (paused, off-screen, reduced motion, or the
// scroll story is in control) the current beat simply holds.
//   stillBeat  beat to show when motion is reduced (a still frame)
//   beat       controlled beat (scroll story); overrides the clock
export default function useLotTimeline({ playing, reducedMotion = false, stillBeat = 'reserve', beat }) {
  const [state, dispatch] = useReducer(lotReducer, initialLotState);

  useEffect(() => {
    if (reducedMotion) dispatch({ type: 'goTo', beat: stillBeat });
  }, [reducedMotion, stillBeat]);

  useEffect(() => {
    if (beat) dispatch({ type: 'goTo', beat });
  }, [beat]);

  const autoplay = playing && !reducedMotion && !beat;
  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), BEATS[beatIndex(state.beat)].duration);
    return () => clearTimeout(timer);
  }, [autoplay, state.beat, state.target]);

  return {
    ...state,
    choose: (bay) => dispatch({ type: 'choose', bay, beat: reducedMotion ? stillBeat : 'route' }),
  };
}
