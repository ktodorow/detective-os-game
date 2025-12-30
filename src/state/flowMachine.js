export const FLOW_STATES = {
  BOOT: 'boot',
  POST_BOOT: 'post_boot',
  BLACKOUT: 'blackout',
  LOADING: 'loading',
  WELCOME: 'welcome',
  DESKTOP: 'desktop'
}

export const FLOW_EVENTS = {
  BOOT_COMPLETE: 'BOOT_COMPLETE',
  SHOW_BLACKOUT: 'SHOW_BLACKOUT',
  SHOW_LOADING: 'SHOW_LOADING',
  LOADING_COMPLETE: 'LOADING_COMPLETE',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS'
}

const transitions = {
  [FLOW_STATES.BOOT]: {
    [FLOW_EVENTS.BOOT_COMPLETE]: FLOW_STATES.POST_BOOT
  },
  [FLOW_STATES.POST_BOOT]: {
    [FLOW_EVENTS.SHOW_BLACKOUT]: FLOW_STATES.BLACKOUT
  },
  [FLOW_STATES.BLACKOUT]: {
    [FLOW_EVENTS.SHOW_LOADING]: FLOW_STATES.LOADING
  },
  [FLOW_STATES.LOADING]: {
    [FLOW_EVENTS.LOADING_COMPLETE]: FLOW_STATES.WELCOME
  },
  [FLOW_STATES.WELCOME]: {
    [FLOW_EVENTS.LOGIN_SUCCESS]: FLOW_STATES.DESKTOP
  },
  [FLOW_STATES.DESKTOP]: {}
}

export function flowReducer(state, event) {
  const nextState = transitions[state]?.[event.type]
  if (!nextState) {
    if (import.meta.env?.DEV) {
      console.warn('Invalid transition', state, event)
    }
    return state
  }
  return nextState
}
