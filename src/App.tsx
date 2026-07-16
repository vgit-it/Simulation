import { BOOT_DEVICE_ID, BOOT_PERSON_ID } from './config';
import { Phone } from './phone/Phone';

/**
 * Stage: centers the booting device on the page. Later this can host multiple
 * devices side by side or a device switcher.
 */
export function App() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#05070d] p-4">
      <Phone personId={BOOT_PERSON_ID} deviceId={BOOT_DEVICE_ID} />
    </div>
  );
}
