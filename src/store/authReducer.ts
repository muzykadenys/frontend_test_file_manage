import {
  AUTH_LOGIN_FAILURE,
  AUTH_LOGIN_REQUEST,
  AUTH_LOGIN_SUCCESS,
  AUTH_LOGOUT,
  AUTH_REGISTER_DONE,
  AUTH_REGISTER_REQUEST,
  AUTH_RESTORE,
} from './actionTypes';
import type { AuthState } from './types';

const initial: AuthState = {
  accessToken: null,
  user: null,
  loading: false,
  error: null,
  registerSuccess: null,
  registerError: null,
};

export function authReducer(state = initial, action: { type: string; payload?: unknown }): AuthState {
  switch (action.type) {
    case AUTH_LOGIN_REQUEST:
      return { ...state, loading: true, error: null };
    case AUTH_REGISTER_REQUEST:
      return { ...state, loading: true, registerSuccess: null, registerError: null };
    case AUTH_LOGIN_SUCCESS:
      return {
        ...state,
        loading: false,
        error: null,
        registerSuccess: null,
        registerError: null,
        accessToken: (action.payload as { accessToken: string }).accessToken,
        user: (action.payload as { user: { id: string; email?: string } }).user,
      };
    case AUTH_LOGIN_FAILURE:
      return { ...state, loading: false, error: String((action.payload as { message?: string })?.message ?? 'Error') };
    case AUTH_REGISTER_DONE: {
      const p = action.payload as { ok: boolean; message: string };
      return {
        ...state,
        loading: false,
        registerSuccess: p.ok ? p.message : null,
        registerError: p.ok ? null : p.message,
      };
    }
    case AUTH_LOGOUT:
      return { ...initial };
    case AUTH_RESTORE:
      return {
        ...state,
        accessToken: (action.payload as { accessToken: string }).accessToken,
        user: (action.payload as { user: { id: string; email?: string } }).user,
      };
    default:
      return state;
  }
}
