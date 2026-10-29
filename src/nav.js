import { createContext, useContext } from 'react';

export const NavContext = createContext(null);

/** { route, go, replace, back, reset, startDuel, startPractice, finishMatch } */
export function useNav() {
  return useContext(NavContext);
}
