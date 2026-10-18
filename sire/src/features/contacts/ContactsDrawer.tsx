import { Drawer } from '../../ui/Dialog';
import { ContactsList } from './ContactsList';

export function ContactsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Contatos de emergência">
      <ContactsList autoFocus />
    </Drawer>
  );
}
