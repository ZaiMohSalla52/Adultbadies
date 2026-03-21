import { redirect } from 'next/navigation';

// The unified inbox (Chats) now serves as the primary match management hub.
export default async function MatchesPage() {
  redirect('/chats');
}
