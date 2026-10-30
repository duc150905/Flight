# Hệ thống Phân quyền Quản trị & Bảo mật Dữ liệu (Flight)

Tài liệu chi tiết về cơ chế phân quyền, bảo vệ thao tác Quản trị viên (Admin) và kiểm soát an toàn dữ liệu trên Supabase và ứng dụng Flight.

---

## 1. Kiến trúc Bảo mật 3 Lớp (Defense in Depth)

Hệ thống bảo vệ phân quyền theo 3 lớp độc lập:

```
[ Lớp 3: Client Guard ] -> useAdmin() & <AdminGuard /> (Ẩn/hiện UI, chặn thao tác người dùng)
          ↓
[ Lớp 2: RPC API ]      -> public.is_admin() (Hàm bảo mật SECURITY DEFINER, kiểm tra session)
          ↓
[ Lớp 1: Database RLS ] -> Row Level Security trên PostgreSQL (Bảo vệ tuyệt đối ở tầng dữ liệu)
```

1. **Lớp 1 - Database Row Level Security (RLS)**:
   - 22/22 bảng nghiệp vụ trên database đều kích hoạt RLS.
   - Bảng vai trò `private.user_roles` được đặt trong schema `private` (không expose ra PostgREST Data API). Người dùng hoặc client không thể tự truy vấn hay ghi đè role.
   - Mọi thao tác ghi danh mục (`airports`, `airlines`, `aircraft`, `destinations`,...), quản lý giá vé (`flight_fares`), và xem toàn bộ đơn hàng đều yêu cầu `(select private.is_admin()) = true`.
2. **Lớp 2 - RPC Bridge**:
   - Hàm `public.is_admin()` đóng vai trò cổng kiểm tra an toàn cho client. Hàm chạy với quyền `SECURITY DEFINER`, tra cứu `private.user_roles` dựa trên `auth.uid()` của JWT token phiên đăng nhập hiện tại và trả về `boolean`.
3. **Lớp 3 - Client UI Guard**:
   - Ứng dụng client sử dụng hook `useAdmin()` và component `<AdminGuard />` để kiểm soát giao diện và điều hướng.

---

## 2. Hướng dẫn Cấp quyền Admin cho tài khoản

Vì lý do bảo mật, quyền admin không lấy từ `user_metadata` (tránh người dùng tự sửa metadata khi đăng ký) mà được lưu trữ trong bảng `private.user_roles`.

### Cách 1: Cấp quyền Admin qua Supabase SQL Editor (Khuyên dùng)

Vào trang **Supabase Dashboard** > Chọn project **flight-dev** > **SQL Editor** và chạy:

```sql
-- 1. Cấp quyền Admin cho tài khoản thông qua Email đã đăng ký
insert into private.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'email_quan_tri_vien@example.com'
on conflict (user_id) do nothing;

-- 2. Kiểm tra danh sách Admin hiện tại
select r.user_id, u.email, r.role, r.created_at
from private.user_roles r
join auth.users u on u.id = r.user_id;
```

### Cách thu hồi quyền Admin:

```sql
delete from private.user_roles
where user_id = (select id from auth.users where email = 'email_can_xoa@example.com');
```

---

## 3. Cách sử dụng trên Frontend React Native

### A. Kiểm tra quyền qua Hook `useAdmin()`

Hook `useAdmin()` tự động phản ứng theo trạng thái đăng nhập:

```tsx
import { useAdmin } from '@/features/auth/use-admin';

export function MyComponent() {
  const { isAdmin, loading, error, refetch } = useAdmin();

  if (loading) return <Text>Đang kiểm tra quyền…</Text>;

  return (
    <View>
      <Text>Vai trò: {isAdmin ? 'Quản trị viên' : 'Khách hàng'}</Text>
      {isAdmin && <Button title="Vào trang Quản trị" onPress={openAdminPanel} />}
    </View>
  );
}
```

### B. Bảo vệ toàn bộ màn hình hoặc khu vực với `<AdminGuard />`

Sử dụng `<AdminGuard />` bọc quanh màn hình hoặc chức năng chỉ dành riêng cho Admin:

```tsx
import { AdminGuard } from '@/features/auth/admin-guard';

export default function AdminFlightScreen() {
  return (
    <AdminGuard>
      {/* Toàn bộ nội dung quản trị ở đây chỉ hiển thị khi tài khoản là Admin */}
      <FlightManagementView />
    </AdminGuard>
  );
}
```

Nếu người dùng chưa được cấp quyền admin, `<AdminGuard />` sẽ tự động hiển thị thông báo:
> *"Truy cập bị từ chối: Tài khoản của bạn không có quyền quản trị viên để thực hiện thao tác này."*

---

## 4. Kiểm thử Tự động (Automated Tests)

Các bài test kiểm thử logic phân quyền nằm tại `tests/admin.test.mjs`:
- Kiểm tra xử lý an toàn khi client null/chưa đăng nhập (`isAdmin: false`).
- Kiểm tra phản hồi RPC thành công (`true` / `false`).
- Kiểm tra xử lý lỗi mạng hoặc lỗi phân quyền database không làm crash ứng dụng.

Chạy kiểm thử:
```powershell
npm.cmd test
npm.cmd run check
```

