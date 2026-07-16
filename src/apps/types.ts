import type { AppDefinition, Device, LoadedPerson } from '../world';

/** Props every app renderer receives when opened inside the phone shell. */
export interface AppScreenProps {
  owner: LoadedPerson;
  device: Device;
  app: AppDefinition;
  onClose: () => void;
}
