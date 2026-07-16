import type { ComponentType } from 'react';
import type { AppScreenProps } from './types';
import { PhotosApp } from './photos/PhotosApp';

/**
 * App registry: maps an app id (from world/apps/*.md) to the React renderer that
 * draws it. Adding an app = author a definition file + add one line here.
 */
export const appRegistry: Record<string, ComponentType<AppScreenProps>> = {
  photos: PhotosApp,
};
