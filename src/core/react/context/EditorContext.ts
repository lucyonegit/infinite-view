import { createContext } from 'react';
import { EditorEngine } from '../../engine/EditorEngine';

export const EditorContext = createContext<EditorEngine | null>(null);
