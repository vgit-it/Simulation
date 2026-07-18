import type { ComponentType } from 'react';
import type { AppScreenProps } from './types';
import { PhotosApp } from './photos/PhotosApp';
import { MessagesApp } from './messages/MessagesApp';
import { ContactsApp } from './contacts/ContactsApp';
import { RemindersApp } from './reminders/RemindersApp';

/**
 * App registry: maps an app id (from world/apps/*.md) to the React renderer that
 * draws it. Adding an app = author a definition file + add one line here.
 */
export const appRegistry: Record<string, ComponentType<AppScreenProps>> = {
  photos: PhotosApp,
  messages: MessagesApp,
  contacts: ContactsApp,
  reminders: RemindersApp,
};
