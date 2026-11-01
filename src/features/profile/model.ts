import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Database } from '@/types/database.generated';

const profileColumns = 'id,full_name,contact_phone';

export type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'contact_phone'>;
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên cần ít nhất 2 ký tự.').max(100, 'Họ tên không quá 100 ký tự.'),
  contactPhone: z.string().trim().refine(value => value === '' || /^\+[1-9][0-9]{7,14}$/.test(value),
    'Nhập số theo mã quốc gia, ví dụ +84912345678.'),
});
export type ProfileInput = z.input<typeof profileSchema>;

export class ProfileMissingError extends Error {
  constructor() { super('Profile row missing or inaccessible'); }
}

export function createProfileService(client: Pick<SupabaseClient<Database>, 'from'>) {
  return {
    async load(userId: string): Promise<Profile> {
      const { data, error } = await client.from('profiles').select(profileColumns).eq('id', userId).maybeSingle();
      if (error) throw error;
      if (!data) throw new ProfileMissingError();
      return data;
    },
    async save(userId: string, input: ProfileInput): Promise<Profile> {
      const { fullName, contactPhone } = profileSchema.parse(input);
      const { data, error } = await client.from('profiles')
        .update({ full_name: fullName, contact_phone: contactPhone || null })
        .eq('id', userId).select(profileColumns).maybeSingle();
      if (error) throw error;
      if (!data) throw new ProfileMissingError();
      return data;
    },
  };
}

export function profileErrorMessage(error: unknown): string {
  return error instanceof ProfileMissingError
    ? 'Không tìm thấy hồ sơ của tài khoản này. Hãy liên hệ quản trị viên.'
    : 'Không thể xử lý hồ sơ. Hãy kiểm tra kết nối và thử lại.';
}
