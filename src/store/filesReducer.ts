import {
  AUTH_LOGOUT,
  FILES_LOAD_FAILURE,
  FILES_LOAD_REQUEST,
  FILES_LOAD_SUCCESS,
  FILES_PARENT_SET_SYNC,
  FILES_SEARCH,
  FILES_SEARCH_RESET,
  FILES_SEARCH_SUCCESS,
  FILES_UPLOAD_PENDING_ADD,
  FILES_UPLOAD_PENDING_REMOVE,
  FILES_VIEW_MODE_SET,
} from './actionTypes';
import type { FilesState } from './types';

const initial: FilesState = {
  viewMode: 'mine',
  parentId: null,
  items: [],
  loading: false,
  error: null,
  searchQuery: '',
  searchResults: null,
  pendingUploads: [],
};

export function filesReducer(state = initial, action: { type: string; payload?: unknown }): FilesState {
  switch (action.type) {
    case FILES_LOAD_REQUEST:
      return { ...state, loading: true, error: null };
    case FILES_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        items: (action.payload as { items: FilesState['items'] }).items,
      };
    case FILES_LOAD_FAILURE:
      return { ...state, loading: false, error: String(action.payload ?? 'Error') };
    case FILES_VIEW_MODE_SET: {
      const p = action.payload as { viewMode: FilesState['viewMode']; parentId?: string | null };
      return {
        ...state,
        viewMode: p.viewMode,
        parentId: p.parentId !== undefined ? p.parentId ?? null : null,
        searchQuery: '',
        searchResults: null,
        loading: true,
        error: null,
        items: [],
        pendingUploads: [],
      };
    }
    case FILES_PARENT_SET_SYNC:
      return { ...state, parentId: (action.payload as { parentId: string | null }).parentId };
    case FILES_SEARCH:
      return { ...state, searchQuery: (action.payload as { q: string }).q };
    case FILES_SEARCH_SUCCESS:
      return { ...state, searchResults: (action.payload as { items: FilesState['items'] }).items };
    case FILES_SEARCH_RESET:
      return { ...state, searchResults: null };
    case FILES_UPLOAD_PENDING_ADD: {
      const row = action.payload as FilesState['pendingUploads'][number];
      if (state.pendingUploads.some((p) => p.clientId === row.clientId)) return state;
      return { ...state, pendingUploads: [...state.pendingUploads, row] };
    }
    case FILES_UPLOAD_PENDING_REMOVE: {
      const { clientId } = action.payload as { clientId: string };
      return { ...state, pendingUploads: state.pendingUploads.filter((p) => p.clientId !== clientId) };
    }
    case AUTH_LOGOUT:
      return initial;
    default:
      return state;
  }
}
