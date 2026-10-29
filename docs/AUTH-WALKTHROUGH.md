# Học code Auth của Flight từ đầu đến cuối

Bản giải thích ngày 29/10/2026, đối chiếu code Auth của commit e6971b6.
Tài liệu dành cho người mới đọc React Native/TypeScript. Code trong từng phần
là nguyên file tại thời điểm viết; giải thích bên dưới đọc theo thứ tự từ trên xuống.
Đây là tài liệu học, không phải một lần sửa hay tái cấu trúc code app.

## 0. Trước khi đọc file: phân biệt 5 thứ

**App** là code chạy trên điện thoại. Nó vẽ form và gửi yêu cầu qua mạng.
**Supabase Auth** là dịch vụ phía server, tạo tài khoản, kiểm tra mật khẩu/mã và cấp phiên.
**Supabase client/SDK** là thư viện trong app, giúp gọi dịch vụ đó và quản lý token.
**Service** ở project này là object gồm các hàm mình viết để kiểm tra đầu vào và gọi SDK.
**Provider** là component React giữ trạng thái Auth chung rồi chia sẻ cho các màn hình.

Ví dụ bạn nhập email/mật khẩu: form thu dữ liệu → service gọi SDK → SDK gọi server.
Server chấp nhận → SDK nhận phiên và phát sự kiện → Provider cập nhật state → màn hình đổi.

Các từ thường gặp:

- `import`: lấy thứ file khác hoặc thư viện đã export.
- `export`: cho file khác sử dụng biến/hàm/component này.
- `const`: khai báo một tên không bị gán lại; object nó trỏ tới vẫn có thể thay đổi.
- `type`: mô tả kiểu cho TypeScript kiểm tra; không chạy như logic JavaScript.
- `Component`: hàm React trả về giao diện, ví dụ `LoginForm`.
- JSX: cách viết `<Text>Hi</Text>` trong JavaScript/TypeScript để mô tả giao diện.
- Props: dữ liệu component nhận từ component cha, ví dụ `title="Sign in"`.
- State: dữ liệu React theo dõi, thay đổi bằng setter thì React lên lịch render lại.
- Render lại: React gọi lại hàm component với state mới để tính giao diện; không phải khởi động lại app.
- Hook: hàm như `useState`, `useEffect`, `useAuth`, thường chỉ gọi ở đầu component/hook.
- `useState('')`: tạo state ban đầu là chuỗi rỗng; trả về `[giá trị, hàm cập nhật]`.
- `useEffect`: chạy phần đồng bộ bên ngoài sau khi React cập nhật giao diện.
- `async`: hàm trả về Promise; `await`: đợi tác vụ bất đồng bộ hoàn tất trong hàm đó.
  Trong lúc chờ mạng, toàn bộ app không bị đứng để chờ theo kiểu chạy đồng bộ.
- Promise: đại diện một kết quả sẽ có sau; có thể thành công hoặc bị reject.
- `try/catch/finally`: thử thực hiện; nhận lỗi nếu có; chạy phần dọn dẹp dù thành công hay thất bại.
- `throw error`: chuyển lỗi lên bên gọi, không phải tự hiển thị lỗi lên màn hình.
- Callback: hàm đưa cho hàm khác để nó gọi lại khi cần.
- `const { data, error } = result`: lấy hai thuộc tính từ object result bằng destructuring.
- `condition ? A : B`: điều kiện đúng dùng A, sai dùng B.
- `condition && X`: chỉ dùng X khi điều kiện đúng; hay dùng để hiện/ẩn JSX.
- `x?.y`: chỉ đọc y khi x không null/undefined; nếu không trả undefined.
- `x ?? fallback`: chỉ dùng fallback khi x là null/undefined, không thay chuỗi rỗng hay số 0.
- `...object`: trải các thuộc tính object vào object/props mới.
- `actions!`: thông báo cho TypeScript rằng lập trình viên tin actions không null ở đây.
  Dấu `!` này không tự kiểm tra hoặc tạo object ở runtime.
- `void submit()`: gọi hàm nhưng không dùng Promise làm giá trị trả về của callback đó.
  Nó không có nghĩa submit không chạy và cũng không tự bắt lỗi.
- `@/`: alias trỏ vào `src/`, được cấu hình trong tsconfig.json.

Session gồm thông tin user, access token, refresh token và thời hạn. Access token
được dùng khi gọi dịch vụ; refresh token phục vụ xin phiên/token mới. App không cần
lưu mật khẩu để giữ đăng nhập. Có session trên giao diện không thay thế kiểm tra quyền
ở backend; bảng đơn vé sau này vẫn phải được phân quyền.

## 1. src/app/_layout.tsx — vỏ ngoài của các màn hình

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/features/auth/auth-provider';

export default function RootLayout() {
  return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></AuthProvider>;
}
```

Đọc từ trên xuống:

1. Import `Stack` từ Expo Router để tạo bộ điều hướng màn hình.
2. Import `StatusBar` để đặt kiểu thanh trạng thái của điện thoại.
3. Import `AuthProvider` mình tự viết, sẽ xem chi tiết ở phần 6.
4. `RootLayout` là component được export mặc định. Expo Router dùng file `_layout`
   làm bố cục bao quanh các route nằm dưới nó.
5. `AuthProvider` nằm ngoài `Stack`: các màn hình do Stack hiển thị có thể dùng `useAuth()`.
6. `StatusBar style="dark"`: chữ/icon của thanh trạng thái dùng kiểu tối.
7. `headerShown: false`: ẩn thanh tiêu đề mặc định của Stack; giao diện Auth tự bố trí tiêu đề.

`<AuthProvider>...</AuthProvider>` không gửi form đăng nhập. Nó dựng nơi giữ trạng thái
chung. Các component bên trong chính là `children` của AuthProvider.

Nếu bỏ Provider mà màn hình vẫn gọi useAuth, hook sẽ báo `AuthProvider missing`.
Nếu chỉ đổi StatusBar hay headerShown, nghiệp vụ đăng nhập không đổi.

## 2. src/app/index.tsx — người quyết định màn hình hiện tại

```tsx
import { ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { AccountScreen } from '@/features/auth/account-screen';
import { ActionButton, AuthShell, Notice, colors, styles } from '@/features/auth/ui';

export default function Index() {
  const { session, status, error, retry } = useAuth();
  if (status === 'loading') return <AuthShell><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.description}>Getting your account ready…</Text></AuthShell>;
  if (status === 'error') return <AuthShell><Text style={styles.title}>Let’s try again</Text><Notice text={error ?? ''} /><ActionButton title="Retry" onPress={retry} /></AuthShell>;
  return session ? <AccountScreen /> : <AuthScreen />;
}
```

Các import đầu file lấy spinner/chữ của React Native, hook Auth và các màn hình/khung
mình tự viết. `Index` là route `/`, màn hình mở đầu của ứng dụng hiện tại.

`const { session, status, error, retry } = useAuth()` đọc dữ liệu từ Provider.
Màn hình không tự đọc AsyncStorage hoặc tự kiểm tra mật khẩu.

Ba nhánh được xét theo thứ tự:

1. Nếu `loading`, trả về khung Auth có spinner và câu đang chuẩn bị tài khoản.
   `return` kết thúc hàm ở đây, nên chưa xét có session hay không. Điều này tránh
   hiện login ngay lập tức rồi chớp sang tài khoản khi phiên cũ vừa được nạp xong.
2. Nếu `error`, trả về khung lỗi, nội dung lỗi và nút Retry. Nút nhận chính hàm
   `retry` của Provider, không phải hàm tự khai báo trong file này.
3. Chỉ khi hai nhánh trên không chạy mới xét session. Có session thì AccountScreen,
   không có thì AuthScreen.

Khi Provider đổi state, component dùng useAuth được render lại. Vì vậy không cần
gọi `router.push` sau khi login: biểu thức cuối tự cho ra component khác.

`error ?? ''` đảm bảo Notice nhận chuỗi ngay cả khi error chưa được đặt.
Spinner có `size` và `color` chỉ là cấu hình hiển thị.

Giới hạn: cơ chế này bảo vệ nội dung của route `/` hiện tại, không tự bảo vệ mọi
route tương lai. Route quản trị/checkout phải có thiết kế điều hướng và quyền riêng.

## 3. src/lib/supabase.ts — kết nối SDK

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined';
const isNative = Platform.OS !== 'web';

export const supabase = url?.startsWith('https://') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, {
      auth: {
        ...(isNative ? { storage: AsyncStorage, lock: processLock } : {}),
        autoRefreshToken: isNative || isBrowser,
        persistSession: isNative || isBrowser,
        detectSessionInUrl: false,
      },
    })
  : null;
```

### Các import

- `react-native-url-polyfill/auto`: import vì tác dụng phụ, bổ sung khả năng xử lý URL
  cần thiết cho môi trường React Native. Không lấy một biến nào từ module này.
- `AsyncStorage`: bộ lưu key/value của ứng dụng trên thiết bị để SDK lưu phiên.
- `createClient`: hàm của Supabase tạo client gọi Auth, database và các dịch vụ khác.
- `processLock`: cơ chế khóa mà SDK dùng để phối hợp thao tác Auth trong cùng tiến trình.
- `Platform`: biết code đang chạy ở Android, iOS hay web.

### Các biến cấu hình

`url` và `key` lấy từ biến môi trường công khai. `?.trim()` bỏ khoảng trắng đầu/cuối
nếu có giá trị; nếu thiếu thì giữ undefined. Không có dòng in khóa ra console.

`isBrowser` chỉ đúng khi đang chạy web VÀ đã có đối tượng window. Code web còn có
thể chạy trên server khi render; lúc đó không có window.
`isNative` đúng khi không phải web, ví dụ Android/iOS.

### Tạo client hoặc trả null

Điều kiện đầu kiểm tra sơ bộ URL bắt đầu `https://`, key bắt đầu `sb_publishable_`.
Đây chỉ là kiểm tra sơ bộ, chưa chứng minh URL thực sự hợp lệ hay key được server chấp nhận.
Nếu đạt thì gọi createClient; nếu không thì export null. Provider sẽ xử lý trường hợp null.

Object `auth` có các lựa chọn:

- `...(isNative ? { storage: AsyncStorage, lock: processLock } : {})`: trên native,
  thêm hai thuộc tính storage/lock. Trên web, trải object rỗng nên không thêm gì;
  SDK dùng cách lưu/khóa mặc định của môi trường web.
- `autoRefreshToken`: bật ở điện thoại hoặc trình duyệt thật; tắt khi render phía server.
- `persistSession`: cho lưu phiên ở thiết bị/trình duyệt; không bật lưu trình duyệt khi render server.
- `detectSessionInUrl: false`: hiện không tự lấy session từ URL quay về. Luồng mình
  thiết kế là nhập mã email trực tiếp. Chỉ bấm link email chưa được code này coi là
  một luồng đăng nhập bằng redirect đã hoàn thiện.

File export một client ở cấp module để các phần cùng import dùng chung trong môi
trường đang chạy, thay vì mỗi lần render lại tạo một client mới.

AsyncStorage không phải kho mã hóa. Hiện dùng theo quickstart React Native;
trước khi phát hành cần đánh giá bảo vệ token phù hợp. Publishable key được phép có
trong app; secret/service_role key không được đặt ở đây.

## 4. src/features/auth/model.ts — quy tắc dữ liệu và hành động Auth

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(100, 'Use no more than 100 characters.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'Use no more than 128 characters.'),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Passwords do not match.', path: ['confirmPassword'],
});
export const otpSchema = z.object({ token: z.string().trim().regex(/^\d{6,10}$/, 'Enter the complete numeric code from your email.') });
export const verificationSchema = otpSchema.extend({ email: emailSchema });
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
type AuthGateway = Pick<SupabaseClient['auth'], 'signUp' | 'signInWithPassword' | 'verifyOtp' | 'resend' | 'signOut'>;

export function createAuthService(auth: AuthGateway) {
  return {
    async login(input: LoginInput) {
      const { data, error } = await auth.signInWithPassword(loginSchema.parse(input));
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async register(input: RegisterInput) {
      const { name, email, password } = registerSchema.parse(input);
      const { data, error } = await auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      return data.session ? 'signed-in' : 'confirmation';
    },
    async verify(email: string, token: string) {
      const { data, error } = await auth.verifyOtp({
        email: emailSchema.parse(email), token: otpSchema.parse({ token }).token, type: 'email',
      });
      if (error) throw error;
      if (!data.session) throw new Error('Session missing');
    },
    async resend(email: string) {
      const { error } = await auth.resend({ type: 'signup', email: emailSchema.parse(email) });
      if (error) throw error;
    },
    async logout() {
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}

export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'The email or password is incorrect.',
    email_not_confirmed: 'Verify your email before signing in. Choose "Verify email" below.',
    user_already_exists: 'Unable to create this account. Try signing in instead.',
    weak_password: 'Your password does not meet the security requirements.',
    over_email_send_rate_limit: 'Email sending limit reached. Please try again later.',
    over_request_rate_limit: 'Too many attempts. Please wait and try again.',
    otp_expired: 'This code is invalid or has expired. Check it or request a new one.',
    email_address_invalid: 'Enter a valid email address.',
    email_address_not_authorized: 'The test email service cannot send to this address yet.',
    signup_disabled: 'New account registration is currently unavailable.',
  };
  return messages[code] ?? 'Something went wrong. Check your connection and try again.';
}
```

### Phần import và schema

`import type` chỉ dùng kiểu SupabaseClient khi kiểm tra TypeScript, không dùng nó
để tạo client trong file này. `z` là Zod, thư viện kiểm tra dữ liệu thực sự khi chạy.

`emailSchema` đi qua chuỗi bước: phải là string → bỏ khoảng trắng hai đầu → chữ thường
→ chuyển vào bộ kiểm tra định dạng email bằng `.pipe(...)`. Sai sẽ có thông báo tiếng Anh.

`loginSchema` mô tả object có email và password. Password đăng nhập chỉ cần có ít
nhất một ký tự; không dùng điều kiện mật khẩu đăng ký mới để chặn tài khoản đã có.
Mật khẩu không bị trim, vì khoảng trắng có thể là một phần của mật khẩu.

`registerSchema = loginSchema.extend(...)`: lấy các trường login rồi bổ sung tên,
confirmPassword và thay quy tắc password thành 8–128 ký tự. Tên được trim và giới
hạn 2–100 ký tự. `.refine` so sánh cả hai trường password. `path` chỉ định lỗi phải
gắn với ô confirmPassword, thay vì trở thành lỗi chung không rõ ô nào.

`otpSchema` có một trường token. Regex `^\d{6,10}$` nghĩa là từ đầu đến cuối chỉ có
6 đến 10 chữ số; trim trước giúp việc dán mã có khoảng trắng đầu/cuối hoạt động.
Schema không biết mã đúng hoặc còn hạn: việc đó phải hỏi server.
`verificationSchema` ghép thêm email vào otpSchema để kiểm tra form xác nhận.

`z.input<typeof ...>` tạo kiểu TypeScript cho đầu vào form từ schema. Kiểu TypeScript
và kiểm tra Zod khác nhau: kiểu giúp phát hiện sai khi viết code, Zod kiểm tra dữ liệu
người dùng thật lúc app chạy.

`AuthGateway = Pick<...>` chỉ yêu cầu 5 phương thức Auth mà service cần. Nó không
tạo thêm backend hay giữ tài khoản. Cách nhận đối tượng auth từ ngoài còn cho phép
test bằng đối tượng giả có đúng các phương thức đang được kiểm tra.

### createAuthService

Hàm nhận `auth` và trả về object có `login/register/verify/resend/logout`.
Nó không chạy cả 5 hành động khi được gọi. Chỉ khi sau đó gọi `actions.login(...)`
thì thân hàm login mới thực hiện.

### login(input)

1. `loginSchema.parse(input)` kiểm tra và trả dữ liệu đã chuẩn hóa. Nếu sai thì throw,
   do đó lệnh gọi mạng chưa được thực hiện.
2. `auth.signInWithPassword(...)` nhờ SDK gửi email/mật khẩu tới Supabase Auth.
3. `await` đợi kết quả, rồi tách data và error.
4. Có error thì throw cho form xử lý. Nếu không lỗi nhưng cũng không có session,
   service coi đây là kết quả chưa đủ để báo đăng nhập thành công.
5. Nếu qua hết, hàm kết thúc mà không trả dữ liệu riêng; form được biết thành công
   vì Promise resolve. Phiên được SDK/Provider cập nhật bằng luồng sự kiện riêng.

### register(input)

1. parse schema đăng ký, lấy name/email/password. confirmPassword chỉ để so khớp,
   không được gửi tới server hay lưu vào metadata.
2. `signUp` tạo yêu cầu đăng ký. `options.data.full_name` là metadata hiển thị.
   Server xử lý mật khẩu; app không tự viết thuật toán băm mật khẩu.
3. Nếu lỗi, throw. Nếu response có session, trả chuỗi `'signed-in'`; chưa có session
   thì trả `'confirmation'` để form biết cần hiện màn hình xác nhận.

Hai chuỗi này là quy ước nội bộ của app, không phải tên trạng thái bảng database.
Chưa có session không tự chứng minh email đã được gửi; kết quả còn phụ thuộc cấu
hình email và hành vi bảo vệ việc dò tài khoản của Supabase.

### verify(email, token)

Kiểm tra email và mã rồi gọi `verifyOtp` với `type: 'email'`. `token` ở hàm này là
mã số người dùng nhập từ email, không phải access token hay refresh token.
Server quyết định đúng/sai và hết hạn. Có lỗi thì throw; không nhận được session
thì cũng throw. Chỉ coi bước này thành công khi server cấp session.

### resend(email)

Chuẩn hóa email, gọi `auth.resend({ type: 'signup', ... })` để yêu cầu gửi lại email
xác nhận đăng ký. Nó không tạo mã ngẫu nhiên trong app, không gọi Resend API trực tiếp.
Nếu Supabase được cấu hình SMTP Resend thì chính Supabase chuyển thư qua SMTP đó.

### logout()

Gọi `signOut({ scope: 'local' })` để đăng xuất phiên hiện tại. Không phải lệnh chủ
động đăng xuất toàn bộ thiết bị của tài khoản. Có lỗi thì form vẫn nhận được lỗi;
service không tự đặt session thành null để che việc SDK thất bại.

### authErrorMessage(error)

Nhận unknown để chấp nhận mọi lỗi bị throw, vì JavaScript không buộc thứ được throw
phải thuộc một kiểu duy nhất. Đầu tiên kiểm tra có phải object và có thuộc tính code
không; nếu có chuyển nó thành chuỗi, nếu không dùng chuỗi rỗng.

`Record<string,string>` là object ánh xạ mã lỗi sang thông báo. Các mã hiện xử lý:

- invalid_credentials: email/mật khẩu không đúng.
- email_not_confirmed: tài khoản cần xác nhận email.
- user_already_exists: không thể đăng ký, gợi ý thử đăng nhập.
- weak_password: mật khẩu chưa đạt chính sách server.
- over_email_send_rate_limit: chạm giới hạn gửi thư.
- over_request_rate_limit: thao tác quá nhiều.
- otp_expired: mã sai/hết hạn.
- email_address_invalid: địa chỉ email không hợp lệ.
- email_address_not_authorized: email chưa được dịch vụ thử nghiệm cho phép.
- signup_disabled: đăng ký bị tắt.

`messages[code] ?? ...` dùng thông báo chung nếu chưa nhận diện lỗi. Mình không
hiển thị thẳng error.message từ server. Nhược điểm là một số lỗi khác nhau đang
có cùng thông báo chung; chưa có hệ thống log chẩn đoán riêng.

## 5. src/features/auth/session.ts — theo dõi và khôi phục phiên

```ts
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export function watchSession(
  auth: Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange'>,
  onSession: (session: Session | null) => void,
  onError: (error: unknown) => void,
  timeoutMs = 15_000,
) {
  let disposed = false;
  let revision = 0;
  const timer = setTimeout(() => {
    if (!disposed) onError(new Error('Session restore timed out'));
  }, timeoutMs);
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION does not carry load errors. getSession owns startup so
    // a temporary network failure remains retryable instead of showing login.
    if (event === 'INITIAL_SESSION') return;
    clearTimeout(timer);
    revision++;
    if (!disposed) onSession(session);
  });
  const initialRevision = revision;
  void auth.getSession().then(({ data, error }) => {
    clearTimeout(timer);
    if (disposed || revision !== initialRevision) return;
    if (error) onError(error);
    else onSession(data.session);
  }).catch(error => {
    clearTimeout(timer);
    if (!disposed && revision === initialRevision) onError(error);
  });
  return () => { disposed = true; clearTimeout(timer); subscription.unsubscribe(); };
}
```

Đây là file khó nhất vì phải phối hợp việc đang chờ với sự kiện có thể xảy ra bất kỳ lúc nào.

### Đầu vào của watchSession

- auth: chỉ cần getSession và onAuthStateChange của SDK.
- onSession: callback để báo session hiện tại, kể cả null khi đã đăng xuất.
- onError: callback để báo khôi phục thất bại.
- timeoutMs: mặc định 15.000 ms. Test có thể truyền thời gian ngắn hơn.

File không vẽ giao diện và không gọi useState. Provider đưa các callback setState vào.

### disposed và revision

`disposed = false`: watcher còn hoạt động. Khi component ngừng dùng nó, chuyển true
để kết quả đang chờ không cập nhật lại state đã bỏ.

`revision = 0`: đếm thay đổi Auth thật kể từ lúc watcher được tạo. Một phản hồi cũ
không được ghi đè một sự kiện mới hơn.

### Timer

setTimeout đặt một lần kiểm tra sau 15 giây. Nếu chưa bị dispose và timer chưa được
xóa, gọi onError để Provider hiện Retry. clearTimeout(timer) xuất hiện ở các đường
hoàn thành nhằm không bắn lỗi sau khi đã có kết quả.
Timeout chỉ ngừng chờ trên giao diện, chưa hủy yêu cầu getSession đang chạy. Một
kết quả thành công đến muộn vẫn có thể làm trạng thái phục hồi nếu watcher còn hợp lệ.

### Đăng ký lắng nghe sự kiện

onAuthStateChange nhận callback `(event, session)`. SDK sẽ gọi callback khi có thay
đổi, ví dụ SIGNED_IN, SIGNED_OUT hoặc TOKEN_REFRESHED. `subscription` được lấy từ
object trả về để sau này có thể unsubscribe.

INITIAL_SESSION được bỏ qua ở callback này: sự kiện ban đầu có thể cho session null
nhưng không mang đủ thông tin lỗi nạp phiên. Code để getSession xử lý kết quả khởi
động và lỗi khởi động; tránh hiểu một lỗi mạng thành người dùng chưa đăng nhập.

Với sự kiện khác: xóa timer → tăng revision → nếu chưa dispose thì gọi onSession.
Callback không await thêm một thao tác Supabase Auth khác bên trong nó.

### Đọc phiên ban đầu

Lưu initialRevision ngay trước khi gọi getSession. `void` thể hiện không trả Promise
này ra ngoài watchSession; kết quả đã được xử lý trong then/catch.

Khi Promise resolve: xóa timer. Nếu đã dispose hoặc revision thay đổi thì bỏ kết quả.
Nếu còn hợp lệ: có error thì gọi onError; không có thì gọi onSession(data.session).
data.session có thể null một cách bình thường khi thiết bị chưa từng đăng nhập.

`.catch(...)` nhận trường hợp Promise bị reject hoặc callback then throw. Nó cũng
kiểm tra disposed/revision để không báo lỗi cũ sau một phiên mới.

### Hàm được return

watchSession trả về một hàm dọn dẹp: đánh dấu dispose, xóa timer và unsubscribe.
Trả về hàm không phải chạy hàm ngay. Provider giữ hàm này để dùng khi effect cleanup.

### Ví dụ vì sao cần revision

Giả sử revision đang 0; getSession đang đợi. Người dùng đăng xuất, callback sự kiện
báo null và tăng revision lên 1. Sau đó phản hồi getSession cũ chứa session cũ quay
về. Vì initialRevision là 0 mà revision là 1, code bỏ phản hồi cũ. Giao diện giữ
trạng thái đăng xuất, không tự đăng nhập lại từ một phản hồi đến muộn.

## 6. src/features/auth/auth-provider.tsx — nối SDK với React

```tsx
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createAuthService } from './model';
import { watchSession } from './session';

const actions = supabase ? createAuthService(supabase.auth) : null;
type AuthState = { session: Session | null; status: 'loading' | 'ready' | 'error'; error?: string };
const AuthContext = createContext<(AuthState & { actions: typeof actions; retry: () => void }) | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AuthState>({ session: null, status: 'loading' });
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const dispose = watchSession(client.auth,
      session => setState({ session, status: 'ready' }),
      () => setState({ session: null, status: 'error', error: 'Could not restore your session. Check your connection and try again.' }));
    if (Platform.OS === 'web') return dispose;
    const syncRefresh = (next: string | null | undefined) => {
      if (next === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    syncRefresh(AppState.currentState);
    const listener = AppState.addEventListener('change', syncRefresh);
    return () => { dispose(); listener.remove(); client.auth.stopAutoRefresh(); };
  }, [attempt]);
  const value = !supabase
    ? { session: null, status: 'error' as const, error: 'Supabase is not configured. Check .env.local and restart the app.' }
    : state;
  return <AuthContext.Provider value={{ ...value, actions, retry: () => {
    setState({ session: null, status: 'loading' }); setAttempt(value => value + 1);
  } }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}
```

### Import và actions ở đầu file

File lấy các hook React, AppState/Platform, client đã tạo, factory tạo service và
watcher phiên. `const actions = ...` chạy ở cấp module: có client thì tạo object
service một lần trong lần nạp module đó; thiếu client thì actions là null.

### AuthState và AuthContext

AuthState mô tả session/status/error. `Session | null` là có phiên hoặc không có.
status dùng ba chuỗi hợp lệ. `error?: string` là thuộc tính có thể vắng mặt.

createContext tạo kênh chia sẻ. Kiểu của giá trị kênh là AuthState kết hợp (`&`) với
actions và retry. Giá trị mặc định null giúp phân biệt trường hợp chưa được Provider bọc.

### State trong component

attempt bắt đầu 0; chỉ tăng khi bấm Retry để effect chạy lại.
state bắt đầu `{ session: null, status: 'loading' }`. Đây chưa phải kết luận đã đăng
xuất; status loading yêu cầu trang index chờ kiểm tra.

### useEffect

Effect phụ thuộc `[attempt]`: chạy sau lần render đầu và khi attempt thay đổi.
Nếu Provider bị tháo khỏi cây React hoặc dependency đổi, React gọi cleanup của lượt cũ.
Trong môi trường phát triển, React có thể chạy thêm chu kỳ effect để kiểm tra cleanup.

`const client = supabase`: giữ biến cục bộ cho các callback, giúp TypeScript biết
client không null sau kiểm tra. Thiếu client thì effect không đăng ký watcher.

watchSession được nhận hai callback:

- Thành công: thay state bằng `{ session, status: 'ready' }`. session có thể null.
- Lỗi: thay state thành session null, status error và một câu hướng dẫn thử lại.

`dispose` là hàm dọn dẹp do watchSession trả về. Trên web effect return dispose
ngay, tức React sẽ dùng nó để cleanup, không phải gọi dispose ngay ở dòng return.

### AppState trên điện thoại

syncRefresh nhận trạng thái hệ điều hành. `active` thì SDK startAutoRefresh, các
trạng thái khác thì stopAutoRefresh. Gọi ngay với AppState.currentState để không
chờ tới lần chuyển trạng thái đầu tiên. Sau đó addEventListener để theo dõi các lần đổi.

Cleanup của native thực hiện ba việc: dispose watcher, remove listener AppState,
dừng auto refresh. Nếu quên cleanup có thể còn nhiều listener hoạt động sau mỗi Retry.

### value và Provider JSX

Nếu thiếu cấu hình, value được thay bằng lỗi cấu hình rõ ràng; không để index đứng
loading vì effect đã return sớm. Nếu có cấu hình, value dùng state bình thường.

`...value` đưa session/status/error vào object chia sẻ; actions là service.
retry đặt state về loading rồi tăng attempt bằng callback `value => value + 1`.
value trong callback tăng số là biến số của setter, khác với object value bên ngoài.

`{children}` render nội dung được bọc bên trong Provider, ở project là bộ Stack.

### useAuth

Hook này đọc AuthContext. Nếu null thì throw để phát hiện màn hình dùng sai vị trí.
Nếu có context thì trả object. Việc gom thành hook giúp các màn hình không phải
import AuthContext và tự lặp kiểm tra mỗi lần.

Provider là nơi duy nhất hiện giữ session cho UI. Zustand chưa tham gia Auth;
Zustand được dự kiến dùng cho bản nháp checkout sau này.

## 7. src/features/auth/ui.tsx — các mảnh giao diện dùng chung

```tsx
import { useState, type PropsWithChildren } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  background: '#F3F7FC', surface: '#FFFFFF', text: '#102A43', muted: '#526579',
  primary: '#1457CF', border: '#CBD5E1', error: '#B42318', errorBg: '#FFF0ED',
  success: '#15603A', successBg: '#EAF7EF', light: '#E9F0FF',
};

export function AuthShell({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.brand}>FLIGHT<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.tagline}>Your next journey starts here.</Text>
          <View style={styles.card}>{children}</View>
          <Text style={styles.footer}>A little planning. A world of possibilities.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function FormField<T extends FieldValues>({ control, name, label, password, ...props }: {
  control: Control<T>; name: FieldPath<T>; label: string; password?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'>) {
  const [visible, setVisible] = useState(false);
  return <Controller control={control} name={name} render={({ field, fieldState }) =>
    <View style={styles.field}>
      <Text nativeID={`${name}-label`} style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, fieldState.error && styles.invalid]}>
        <TextInput {...props} ref={field.ref} value={field.value ?? ''} onChangeText={field.onChange}
          onBlur={field.onBlur} accessibilityLabel={label} accessibilityLabelledBy={`${name}-label`}
          secureTextEntry={password && !visible} placeholderTextColor={colors.muted} style={styles.input} />
        {password && <Pressable onPress={() => setVisible(value => !value)} accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} style={styles.reveal}>
          <Text style={styles.link}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>}
      </View>
      {fieldState.error && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{fieldState.error.message}</Text>}
    </View>} />;
}

export function ActionButton({ title, onPress, busy = false, disabled = false, secondary = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
    accessibilityState={{ disabled: disabled || busy, busy }}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.primary : colors.surface} accessibilityLabel="Please wait" />
      : <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>}
  </Pressable>;
}

export function Notice({ text, success = false }: { text: string; success?: boolean }) {
  if (!text) return null;
  return <View style={[styles.notice, success && styles.successNotice]}>
    <Text accessibilityLiveRegion="polite" style={{ color: success ? colors.success : colors.error, lineHeight: 22 }}>{text}</Text>
  </View>;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  brandDot: { color: colors.primary }, tagline: { color: colors.muted, fontSize: 16, marginBottom: 16 },
  card: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, gap: 16, borderWidth: 1, borderColor: '#E4EBF4' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  field: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  inputRow: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  invalid: { borderColor: colors.error }, input: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, color: colors.text },
  reveal: { minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 }, errorText: { color: colors.error, fontSize: 13, lineHeight: 19 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  secondary: { backgroundColor: colors.light }, secondaryText: { color: colors.primary },
  disabled: { opacity: 0.55 }, pressed: { opacity: 0.8 },
  notice: { borderRadius: 12, padding: 12, backgroundColor: colors.errorBg }, successNotice: { backgroundColor: colors.successBg },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 20 },
});
```

### Import và colors

useState dùng cho nút hiện/ẩn mật khẩu. PropsWithChildren thêm kiểu children.
Controller và các kiểu Control/FieldPath/FieldValues đến từ React Hook Form.
Các phần Text, View, TextInput, Pressable... là thành phần giao diện React Native.
SafeAreaView tránh nội dung nằm trong vùng tai thỏ/thanh trạng thái.

colors gom màu có tên: background là nền, surface là bề mặt form, text là chữ chính,
muted là chữ phụ, primary là nút chính, border là viền, error/errorBg cho lỗi,
success/successBg cho thành công, light là nền nhạt của nút phụ.

### AuthShell

Hàm nhận children, bọc bởi SafeAreaView. KeyboardAvoidingView điều chỉnh bố cục
khi bàn phím mở: iOS dùng padding, Android dùng height. ScrollView cho phép cuộn
form dài. `keyboardShouldPersistTaps="handled"` giúp các thao tác bấm đã được con
xử lý không chỉ bị dùng để đóng bàn phím.

View content chứa thương hiệu, tagline, khung card có children và câu footer.
Ví dụ `<AuthShell><LoginForm /></AuthShell>` đặt LoginForm vào vị trí children đó.
Shell không biết người dùng đang login hay register và không gọi backend.

### FormField: khai báo props

`<T extends FieldValues>` làm component dùng được với nhiều kiểu form. Control<T>
là bộ điều khiển của đúng form đó. FieldPath<T> kiểm tra tên trường thuộc form;
ví dụ form login có email/password thì không được tùy tiện gõ một trường không tồn tại.

label là chữ nhãn. password có dấu `?` nên tùy chọn. `Omit<TextInputProps,...>` cho
phép nhận các props input thông thường nhưng bỏ value/onChangeText/secureTextEntry
khỏi props công khai vì FormField tự quản lý ba thứ này. `...props` nhận phần còn lại.

### FormField: liên kết với form

visible bắt đầu false. Controller nhận control và name để biết đang điều khiển ô
nào. Callback render được thư viện gọi với field và fieldState.

- field.value: giá trị hiện tại của ô.
- field.onChange: cập nhật giá trị về React Hook Form khi gõ.
- field.onBlur: báo ô đã mất focus.
- field.ref: tham chiếu tới input, giúp thư viện focus ô cần sửa.
- fieldState.error: lỗi validation của riêng trường này.

Text đầu là label và có nativeID. View bọc input lấy thêm styles.invalid khi có lỗi.
TextInput nhận ...props trước, rồi các props FormField quản lý được gán sau.
`field.value ?? ''` tránh truyền undefined vào ô nhập.
accessibilityLabel/LabelledBy giúp công nghệ hỗ trợ đọc tên ô.

`secureTextEntry={password && !visible}` chỉ che nội dung khi là ô password và
chưa bấm Show. `password && <Pressable...>` nghĩa là chỉ ô mật khẩu mới có nút Show/Hide.
`setVisible(value => !value)` đảo boolean; nó không đổi mật khẩu trong form.

Nếu fieldState.error có giá trị thì hiện thông báo dưới ô, có live region để hỗ trợ
thông báo thay đổi cho người dùng công nghệ hỗ trợ. Chữ Show/Hide không tham gia Auth.

### ActionButton

Nhận title/onPress và các cờ busy/disabled/secondary. Ba cờ có giá trị mặc định false
để bên gọi không phải truyền hết. Pressable bị vô hiệu hóa nếu disabled hoặc busy.
accessibilityRole xác định đây là nút; accessibilityState truyền trạng thái tương ứng.

Hàm style nhận pressed do Pressable cung cấp, không phải state tự tạo. Mảng style
gồm nền cơ bản, nền nút phụ nếu secondary, độ mờ nếu bận/khóa và độ mờ khi đang nhấn.

busy thì hiện ActivityIndicator; không busy thì hiện title. Màu spinner/chữ đổi
theo nút chính hoặc phụ để dễ đọc. Đây là hỗ trợ UI, không phải khóa đồng bộ cho API.

### Notice

Không có text thì return null, tức không dựng khung thông báo rỗng.
Có text thì tạo View nền lỗi mặc định; success=true đổi nền/chữ sang màu thành công.
Thành phần này chỉ trình bày chuỗi do bên gọi đưa vào, không tự dịch mã lỗi.

### Toàn bộ nhóm styles

- flex và safe: chiếm vùng màn hình, đặt nền.
- scroll: cho nội dung nở đủ vùng, căn giữa theo chiều dọc, chừa lề ngang/dọc.
- content: rộng theo khung, tối đa 460, tự căn giữa, giãn khoảng giữa các phần.
- brand/brandDot/tagline: chữ thương hiệu, dấu chấm nhấn màu và câu bên dưới.
- card: nền form, khoảng đệm 24, bo góc 24, khoảng cách nội bộ 16, viền nhẹ.
- title/description: tiêu đề và đoạn mô tả có cỡ/chiều cao dòng khác nhau.
- field/label: khoảng cách label-input-lỗi và định dạng nhãn.
- inputRow: khung input cao tối thiểu 52, viền, bo góc và bố trí input/nút ngang hàng.
- invalid: thay màu viền khi lỗi.
- input: co giãn phần còn lại, minWidth=0 để không ép tràn hàng, padding và màu chữ.
- reveal: vùng bấm Show/Hide đủ rộng/cao và căn chữ giữa.
- link/errorText: định dạng chữ thao tác và chữ lỗi.
- button/buttonText: chiều cao tối thiểu, nền, căn giữa, khoảng đệm và chữ nút.
- secondary/secondaryText: ghi đè màu nền/chữ cho nút phụ.
- disabled/pressed: độ mờ phản hồi bận/khóa/nhấn; không tự quản lý trạng thái nghiệp vụ.
- notice/successNotice: khung và nền thông báo.
- footer: chữ cuối màn hình, căn giữa và khoảng cách với card.

StyleSheet.create gom cấu hình style có tên để tái sử dụng và kiểm tra kiểu.
Các con số style điều khiển hình thức; không ảnh hưởng số giây hết hạn OTP hay mật khẩu.

## 8. src/features/auth/auth-screen.tsx — ba form khi chưa đăng nhập

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { useAuth } from './auth-provider';
import { authErrorMessage, loginSchema, registerSchema, verificationSchema, type LoginInput, type RegisterInput } from './model';
import { ActionButton, AuthShell, FormField, Notice, styles } from './ui';

type Mode = 'login' | 'register' | 'verify';
type Navigation = { change: (mode: Mode, email?: string) => void };
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const change = (next: Mode, email = '') => { setEmail(email); setMode(next); };
  return <AuthShell>
    {mode === 'login' && <LoginForm change={change} />}
    {mode === 'register' && <RegisterForm change={change} />}
    {mode === 'verify' && <VerifyForm initialEmail={email} change={change} />}
  </AuthShell>;
}

function LoginForm({ change }: Navigation) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, getValues, formState: { isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { await actions!.login(values); } catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
    <Text style={styles.description}>Sign in to keep your journeys in one place.</Text>
    <FormField control={control} name="email" label="Email address" autoCapitalize="none" autoCorrect={false}
      keyboardType="email-address" autoComplete="email" editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Password" password autoCapitalize="none" autoCorrect={false}
      autoComplete="current-password" editable={!isSubmitting} returnKeyType="go" onSubmitEditing={() => void submit()} />
    <Notice text={error} />
    <ActionButton title="Sign in" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Create an account" secondary disabled={isSubmitting} onPress={() => change('register')} />
    <ActionButton title="Verify email" secondary disabled={isSubmitting} onPress={() => change('verify', getValues('email'))} />
  </>;
}

function RegisterForm({ change }: Navigation) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try {
      const result = await actions!.register(values);
      if (result === 'confirmation') change('verify', values.email.trim().toLowerCase());
    } catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Start your journey</Text>
    <Text style={styles.description}>Create your Flight account. Passenger details can be added when you book.</Text>
    <FormField control={control} name="name" label="Full name" autoComplete="name" autoCapitalize="words" editable={!isSubmitting} />
    <FormField control={control} name="email" label="Email address" autoComplete="email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="you@example.com" />
    <FormField control={control} name="password" label="Password" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} placeholder="At least 8 characters" />
    <FormField control={control} name="confirmPassword" label="Confirm password" password autoComplete="new-password"
      autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Create account" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Back to sign in" secondary disabled={isSubmitting} onPress={() => change('login')} />
  </>;
}

function VerifyForm({ initialEmail, change }: Navigation & { initialEmail: string }) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [nextSend, setNextSend] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const { control, handleSubmit, getValues, trigger, formState: { isSubmitting } } = useForm<{ email: string; token: string }>({
    resolver: zodResolver(verificationSchema), defaultValues: { email: initialEmail, token: '' },
  });
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((nextSend - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [nextSend]);
  const submit = handleSubmit(async ({ email, token }) => {
    setError(''); setMessage('');
    try { await actions!.verify(email, token); } catch (error) { setError(authErrorMessage(error)); }
  });
  const resend = async () => {
    if (resending || Date.now() < nextSend || !await trigger('email')) return;
    setResending(true); setError(''); setMessage('');
    try {
      await actions!.resend(getValues('email'));
      setNextSend(Date.now() + 60_000); setSeconds(60);
      setMessage('If this account is awaiting confirmation, a new code has been sent. Check your inbox and spam folder.');
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setResending(false); }
  };
  const busy = isSubmitting || resending;
  return <>
    <Text accessibilityRole="header" style={styles.title}>Check your inbox</Text>
    <Text style={styles.description}>Enter the code from your confirmation email. You can return here later to finish verification.</Text>
    <FormField control={control} name="email" label="Email address" keyboardType="email-address" autoComplete="email"
      autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <FormField control={control} name="token" label="Verification code" keyboardType="number-pad"
      autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
    <Notice text={error} /><Notice text={message} success />
    <ActionButton title="Verify email" busy={isSubmitting} disabled={resending} onPress={() => void submit()} />
    <ActionButton title={seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'} secondary busy={resending}
      disabled={isSubmitting || seconds > 0} onPress={() => void resend()} />
    <ActionButton title="Back to sign in" secondary disabled={busy} onPress={() => change('login')} />
  </>;
}
```

### Import và kiểu

zodResolver nối Zod với React Hook Form. useForm quản lý dữ liệu form. useState
giữ state giao diện; useEffect dùng timer. Text dùng để vẽ chữ. Các import còn lại
là hook Provider, quy tắc/service error và thành phần giao diện chung đã giải thích.

Mode là kiểu chỉ nhận login/register/verify. Navigation mô tả prop change: nhận
một Mode và email tùy chọn, không trả kết quả để bên gọi sử dụng.

### AuthScreen

mode bắt đầu login; email bắt đầu rỗng. Hàm change đặt email dùng để bàn giao rồi
đổi mode. Nếu gọi chỉ `change('register')`, tham số email dùng mặc định chuỗi rỗng.

Ba biểu thức mode === ... && ... chỉ dựng một form phù hợp. Cả ba dùng một Shell.
Khi đổi mode, form cũ bị tháo, state/form bên trong nó được tạo lại khi quay về.
Đây là chuyển nội dung trong cùng route, chưa tạo route riêng cho mỗi bước.

### LoginForm: thu dữ liệu

Lấy actions từ Provider; error là thông báo lỗi API riêng của form.
useForm<LoginInput> khai báo form login. resolver dùng loginSchema để kiểm tra khi
submit. defaultValues đặt email/password rỗng. control được đưa vào từng FormField.
handleSubmit tạo hàm kiểm tra rồi mới gọi callback; getValues đọc giá trị đang nhập
mà không tự submit. isSubmitting cho biết đang chạy callback submit bất đồng bộ.

### LoginForm: xử lý submit

`submit = handleSubmit(async values => ...)` tạo một hàm, chưa gửi mạng tại lúc render.
Khi người dùng bấm Sign in, submit chạy validation. Sai thì Controller nhận lỗi
ở từng ô, callback không được gọi. Đúng thì callback xóa lỗi API cũ và await login.
Nếu service throw, catch đổi lỗi thành chữ rồi setError để Notice hiển thị.

`actions!` dựa vào giả định Index chỉ hiển thị AuthScreen khi cấu hình hợp lệ và
Provider ở trạng thái ready. Nó không phải cơ chế kiểm tra null ở runtime.

### LoginForm: JSX

Hai Text đầu là tiêu đề và lời hướng dẫn. Email field dùng bàn phím email,
không tự viết hoa/sửa từ. Password field bật che mật khẩu, gợi ý trình quản lý mật
khẩu hiện tại và cho phím Go trên bàn phím gọi cùng submit.
editable={!isSubmitting} tạm khóa sửa input trong khi gửi.

Notice lấy lỗi API. Nút Sign in gọi submit. Nút Create an account gọi change register.
Nút Verify email đọc email đang gõ bằng getValues rồi bàn giao sang VerifyForm,
giúp người đã đăng ký trước đó quay lại xác nhận.

`onPress={() => void submit()}` truyền một hàm để chạy sau lúc bấm. Nếu viết gọi
submit trực tiếp ở lúc dựng JSX thay vì truyền callback thì thời điểm chạy sẽ sai.

### RegisterForm

Vẫn cùng cấu trúc: actions, error, useForm, submit và JSX. Khác là RegisterInput,
registerSchema và 4 defaultValues name/email/password/confirmPassword.

Submit xóa lỗi cũ, gọi actions.register. Nếu kết quả confirmation thì change verify
và truyền email đã chuẩn hóa. Nếu kết quả signed-in thì không đổi mode thủ công:
sự kiện phiên sẽ khiến Index đổi toàn bộ AuthScreen sang AccountScreen.
Catch dùng cùng bộ chuyển lỗi.

JSX có 4 FormField. Full name dùng gợi ý tên và viết hoa đầu từ; email như login;
hai ô mật khẩu dùng autoComplete new-password để hỗ trợ tạo mật khẩu mới.
Placeholder là gợi ý hiển thị, không phải validation; validation nằm ở schema.
Create account gọi submit; Back to sign in đổi mode, bị khóa khi submit đang chạy.

Không có phone/date of birth/passport trong form này. Tên được lưu vào Auth metadata;
chưa tạo profiles. Chuyển sang màn hình mã không có nghĩa đã hoàn tất đăng ký xác nhận.

### VerifyForm: các state

- initialEmail: email AuthScreen bàn giao, dùng làm defaultValues.
- error: lỗi gửi/xác nhận.
- message: thông báo gửi lại thành công theo cách không xác nhận email có tài khoản hay chưa.
- resending: đang đợi yêu cầu gửi lại thư.
- nextSend: mốc thời gian epoch milliseconds sau đó được phép bấm gửi lại theo UI.
- seconds: số giây hiển thị còn phải chờ.
- isSubmitting: trạng thái đang xác nhận mã do React Hook Form quản lý.

Form có email/token và dùng verificationSchema. Người dùng có thể sửa email nếu
quay lại từ login hoặc đã gõ nhầm; gửi lại sẽ yêu cầu xác nhận cho email đang nhập.

### VerifyForm: timer

Effect tạo setInterval chạy mỗi 1 giây. Lấy nextSend trừ Date.now để tính số ms còn
lại, chia 1000 ra giây, làm tròn lên rồi chặn tối thiểu 0. Tính từ mốc giờ giúp hạn
chế sai lệch nếu một nhịp timer chạy chậm. Khi nextSend đổi, cleanup hủy timer cũ
rồi tạo timer mới. Khi form unmount cũng hủy timer.

nextSend ban đầu bằng 0 nên UI ban đầu không áp đặt 60 giây chờ. Cooldown chỉ bắt
đầu sau lần resend thành công trong form. Đóng/mở form cũng làm mất cooldown này;
giới hạn server vẫn là nguồn thực thi cuối cùng.

### VerifyForm: submit xác nhận

handleSubmit kiểm tra email và token. Callback xóa error/message cũ, gọi verify.
Thành công được thể hiện bằng sự kiện session về Provider. Lỗi đi qua catch và Notice.

### VerifyForm: resend

Điều kiện đầu chặn nếu đang gửi lại, chưa tới nextSend hoặc email không qua trigger.
`trigger('email')` chỉ kiểm tra ô email; không yêu cầu token hợp lệ để gửi lại mã.
Sau đó bật resending và xóa thông báo cũ. Gọi resend bằng email hiện tại; thành công
đặt nextSend sau 60.000 ms, đặt seconds=60 để hiển thị ngay và đưa thông báo thành công.
catch ghi lỗi, finally tắt resending dù kết quả ra sao.

Điểm cần sửa đã phát hiện: khóa resending là React state và được đặt SAU await trigger.
Hai lần gọi gần nhau trước khi state/render cập nhật có thể cùng gửi yêu cầu. Cần
khóa đồng bộ trước phần await (ví dụ useRef). Tài liệu này mô tả code hiện tại,
không ngầm sửa hoặc khẳng định đã sửa hạn chế đó.

### VerifyForm: các field/nút

busy = isSubmitting || resending: có một thao tác chạy thì khóa input/đổi màn hình.
Email field có các thuộc tính giống login. Token field dùng bàn phím số, gợi ý mã
dùng một lần, tối đa 10 ký tự. Bàn phím số không thay thế Zod/server validation.
Hai Notice tách lỗi và thông báo thành công.

Verify email có spinner khi đang xác nhận và bị disable khi đang resend.
Resend code có spinner khi gửi lại, disable khi đang verify hoặc còn đếm ngược;
title đổi thành câu có số giây. Back to sign in gọi change login khi không busy.

## 9. src/features/auth/account-screen.tsx — tài khoản và đăng xuất

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './model';
import { ActionButton, AuthShell, Notice, styles, colors } from './ui';

export function AccountScreen() {
  const { session, actions } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = typeof session?.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : 'Traveler';
  const logout = async () => {
    setBusy(true); setError('');
    try { await actions!.logout(); } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <AuthShell>
    <Text style={[styles.label, { color: colors.success }]}>SIGNED IN</Text>
    <Text accessibilityRole="header" style={styles.title}>Welcome, {name}</Text>
    <Text style={styles.description}>Your account is ready for your next journey.</Text>
    <Text style={styles.label}>Email address</Text>
    <Text selectable style={styles.description}>{session?.user.email}</Text>
    <Notice text="Flight search and booking will arrive in the next milestone." success />
    <Notice text={error} />
    <ActionButton title="Sign out" busy={busy} secondary onPress={() => void logout()} />
  </AuthShell>;
}
```

Các import lấy state, Text và phần dùng chung. Component đọc session/actions,
tạo busy=false và error rỗng.

Biến name kiểm tra full_name từ metadata có đúng kiểu string không. Nếu đúng dùng
nó, nếu không dùng Traveler. `session?.` tránh đọc thuộc tính của null/undefined;
kiểm tra kiểu giúp dữ liệu metadata bất thường không bị render như object.

Hàm logout bật busy, xóa lỗi cũ, await service logout. Có lỗi thì ghi thông báo;
finally tắt busy. SDK báo SIGNED_OUT mới khiến Provider cập nhật session null và
Index đổi về AuthScreen. Component không tự đổi route hay tự xóa AsyncStorage.

JSX hiển thị nhãn signed in, tên, lời chào, email, thông báo booking chưa có và
nút Sign out. selectable cho phép chọn/copy email. Notice lỗi không hiển thị nếu
error rỗng. Nút phụ có spinner trong khi chờ logout.

Đây là màn hình tài khoản tối thiểu; chưa có sửa hồ sơ, đổi mật khẩu, avatar hay
lịch sử vé. Không dùng việc hiện dòng SIGNED IN làm cơ chế bảo vệ dữ liệu backend.

## 10. tests/auth.test.mjs — kiểm tra quy tắc và dữ liệu gọi API

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, registerSchema, otpSchema, createAuthService, authErrorMessage } from '../src/features/auth/model.ts';

const credentials = { email: '  Person@Example.com ', password: '  password123  ' };
test('login normalizes email without modifying a password', () => {
  assert.deepEqual(loginSchema.parse(credentials), { email: 'person@example.com', password: '  password123  ' });
});
test('malformed email and empty password cannot be submitted', () => {
  assert.equal(loginSchema.safeParse({ email: 'bad', password: '' }).success, false);
});
test('registration rejects mismatched and short passwords', () => {
  for (const [password, confirmPassword] of [['password123', 'different'], ['abc', 'abc']]) {
    assert.equal(registerSchema.safeParse({ name: 'Duc', email: 'a@b.com', password, confirmPassword }).success, false);
  }
});
test('OTP accepts digits and rejects incomplete or nonnumeric codes', () => {
  assert.equal(otpSchema.safeParse({ token: '123456' }).success, true);
  for (const token of ['123', 'abcdef', '12345678901']) assert.equal(otpSchema.safeParse({ token }).success, false);
});
test('signup requests confirmation when the server has not issued a session', async () => {
  let request;
  const actions = createAuthService({ signUp: async input => { request = input; return { data: { session: null }, error: null }; } });
  assert.equal(await actions.register({ ...credentials, name: '  Duc  ', confirmPassword: credentials.password }), 'confirmation');
  assert.deepEqual(request, { email: 'person@example.com', password: '  password123  ', options: { data: { full_name: 'Duc' } } });
});
test('invalid registration never reaches the remote auth API', async () => {
  let calls = 0;
  const actions = createAuthService({ signUp: async () => { calls++; } });
  await assert.rejects(() => actions.register({ ...credentials, name: 'Duc', confirmPassword: 'wrong' }));
  assert.equal(calls, 0);
});
test('login sends normalized credentials and propagates auth errors', async () => {
  const actions = createAuthService({ signInWithPassword: async input => {
    assert.equal(input.email, 'person@example.com');
    return { data: { session: null }, error: { code: 'invalid_credentials' } };
  } });
  await assert.rejects(() => actions.login(credentials), e => e.code === 'invalid_credentials');
});
test('verification must receive a session before it succeeds', async () => {
  const actions = createAuthService({ verifyOtp: async input => {
    assert.deepEqual(input, { email: 'person@example.com', token: '123456', type: 'email' });
    return { data: { session: null }, error: null };
  } });
  await assert.rejects(() => actions.verify(credentials.email, '123456'));
});
test('verification accepts a server-issued session', async () => {
  const actions = createAuthService({ verifyOtp: async () => ({ data: { session: { user: { id: 'user' } } }, error: null }) });
  await actions.verify('person@example.com', '123456');
});
test('resend requests a signup email and signout is device-local', async () => {
  const actions = createAuthService({
    resend: async input => { assert.deepEqual(input, { type: 'signup', email: 'person@example.com' }); return { error: null }; },
    signOut: async input => { assert.deepEqual(input, { scope: 'local' }); return { error: null }; },
  });
  await actions.resend(credentials.email);
  await actions.logout();
});
test('error messages do not expose unexpected server data', () => {
  assert.equal(authErrorMessage({ message: 'sensitive server internals' }).includes('sensitive'), false);
  assert.notEqual(authErrorMessage({ code: 'email_not_confirmed' }), authErrorMessage({ code: 'invalid_credentials' }));
});
```

File .mjs chạy bằng Node, không dựng màn hình React Native. `test` khai báo từng
ca; assert kiểm tra kết quả. credentials cố ý có khoảng trắng/hoa để bắt lỗi chuẩn hóa.

Các cách assert:

- equal so giá trị đơn giản; deepEqual so cấu trúc/nội dung object.
- rejects đợi Promise phải thất bại; nếu nó thành công bất ngờ thì test fail.
- safeParse trả object success thay vì throw, phù hợp kiểm tra dữ liệu sai.
- parse dùng trực tiếp ở trường hợp cần dữ liệu chuẩn hóa.

Đọc từng test theo thứ tự:

1. Email được trim/lowercase nhưng password vẫn giữ nguyên khoảng trắng.
2. Email sai/mật khẩu rỗng không đạt schema.
3. Hai bộ dữ liệu lần lượt kiểm tra password không khớp và password quá ngắn.
4. Mã số hợp lệ được nhận; mã thiếu, chữ và quá dài bị loại.
5. signUp giả ghi lại payload và trả session null. Test xác nhận service trả
   confirmation, chỉ gửi full_name/email/password đúng và không gửi confirmPassword.
6. Form sai phải thất bại trước khi gọi signUp; biến calls giữ 0.
7. API giả kiểm tra email chuẩn hóa rồi trả invalid_credentials; service phải throw
   đúng lỗi đó cho bên gọi, không nuốt lỗi và báo thành công.
8. verifyOtp giả nhận đúng email/token/type nhưng trả session null; service phải thất bại.
9. verifyOtp giả trả session thì thao tác resolve thành công.
10. resend có type signup; signOut có scope local, tránh lỡ đăng xuất tất cả thiết bị.
11. Thông báo lạ không làm lộ nội dung server, email chưa xác nhận khác sai mật khẩu.

Các đối tượng auth giả chỉ có phương thức cần dùng trong test đó. Đây là điểm nối
dịch vụ bên ngoài, giúp test không gửi email/tạo tài khoản thật. File JavaScript không
bị ràng buộc đầy đủ như kiểu TypeScript của SupabaseClient. Dữ liệu session giản lược
trong test không chứng minh JWT thật hợp lệ; nó kiểm tra nhánh xử lý của code mình.

## 11. tests/session.test.mjs — kiểm tra thứ tự phản hồi và sự kiện

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchSession } from '../src/features/auth/session.ts';

function setup(timeoutMs) {
  let complete, fail, notify;
  let unsubscribed = false;
  const sessions = [], errors = [];
  const auth = {
    getSession: () => new Promise((resolve, reject) => { complete = resolve; fail = reject; }),
    onAuthStateChange: callback => {
      notify = callback;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
  };
  const dispose = watchSession(auth, value => sessions.push(value), error => errors.push(error), timeoutMs);
  return { sessions, errors, dispose, complete: value => complete(value), fail: value => fail(value),
    notify: value => notify('SIGNED_OUT', value), initial: value => notify('INITIAL_SESSION', value), isUnsubscribed: () => unsubscribed };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('startup restores a persisted session', async () => {
  const s = setup(); s.complete({ data: { session: { user: { id: 'a' } } }, error: null });
  await tick(); assert.equal(s.sessions[0].user.id, 'a'); s.dispose();
});
test('stale startup cannot restore a session after sign-out', async () => {
  const s = setup(); s.notify(null); s.complete({ data: { session: { user: { id: 'a' } } }, error: null });
  await tick(); assert.deepEqual(s.sessions, [null]); s.dispose();
});
test('unmount unsubscribes and ignores pending work', async () => {
  const s = setup(); s.dispose(); s.complete({ data: { session: null }, error: null });
  await tick(); assert.equal(s.isUnsubscribed(), true); assert.deepEqual(s.sessions, []);
});
test('startup rejection becomes a recoverable error', async () => {
  const s = setup(); s.fail(new Error('offline')); await tick();
  assert.equal(s.errors.length, 1); s.dispose();
});
test('INITIAL_SESSION null cannot hide a startup network error', async () => {
  const s = setup(); s.initial(null);
  s.complete({ data: { session: null }, error: { code: 'network_error' } });
  await tick(); assert.deepEqual(s.sessions, []); assert.equal(s.errors.length, 1); s.dispose();
});
test('a stalled restore becomes a retryable error instead of an endless spinner', async () => {
  const s = setup(10); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(s.errors.length, 1); s.dispose();
});
```

setup tạo môi trường Auth giả có thể điều khiển thời điểm. getSession trả Promise
chưa hoàn tất ngay; nó giữ resolve/reject vào biến complete/fail. onAuthStateChange
giữ callback vào notify. unsubscribe giả đổi một cờ để test kiểm tra đã dọn listener.

sessions/errors là hai mảng ghi nhận callback watcher báo ra. setup trả các hàm
điều khiển chứ không phải tự động chạy hết. notify gửi sự kiện SIGNED_OUT; initial
gửi INITIAL_SESSION. isUnsubscribed đọc cờ dọn dẹp.

tick chờ một lượt event loop bằng setImmediate để các callback Promise đã lên lịch
có cơ hội chạy trước khi assert. Nó không phải API của app điện thoại.

Sáu test:

1. Cho getSession hoàn tất với session giả: watcher báo user tương ứng.
2. Gửi SIGNED_OUT trước rồi cho getSession cũ hoàn tất: chỉ nhận null, không nhận lại user cũ.
3. Dispose trước khi kết quả tới: subscription bị hủy và không báo session sau đó.
4. Promise reject như lỗi offline: báo một lỗi, để UI có thể hiện Retry.
5. INITIAL_SESSION(null) đến rồi getSession báo lỗi mạng: không được báo ready(null)
   và bỏ mất lỗi; test này bảo vệ bản sửa ở session.ts.
6. GetSession không hoàn tất trong timeout thử 10 ms: phải báo lỗi thay vì chờ mãi.

Các test này dùng fake callbacks để điều khiển thứ tự rõ ràng. Chưa kiểm tra adapter
AsyncStorage thật, AppState thật hay hành vi foreground/background trên Android.

## 12. supabase/templates/confirmation.html — nội dung email

```html
<h2>Confirm your Flight account</h2>
<p>Enter this verification code in the Flight app:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>If you did not create an account, you can ignore this email.</p>
```

Dòng 1 là tiêu đề h2. Dòng 2 hướng dẫn nhập mã trong app. Dòng 3 hiển thị biểu thức
template `{{ .Token }}` bằng chữ lớn, đậm, giãn ký tự. Khi Supabase gửi thư, máy chủ
thay biểu thức này bằng mã; trình duyệt mở file trên máy chỉ thấy nội dung template.
Dòng 4 là lời nhắc người không yêu cầu đăng ký có thể bỏ qua thư.

Đây không phải script gửi mail, không phải website xác nhận và không phải database.
Phải cấu hình email template trong Supabase để nội dung này được sử dụng. Hiện code
chưa tự đẩy file lên Dashboard. Free project mới dùng SMTP mặc định có giới hạn sửa
template; cần cấu hình gửi thư phù hợp trước khi thử luồng nhập mã đầu cuối.

## 13. Các file cấu hình/tài liệu liên quan

### .env.example

```dotenv
# Copy to .env.local after creating your Supabase development project.
# Only public client configuration belongs in EXPO_PUBLIC_ variables.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Hai dòng comment mô tả cách sao chép cấu hình. Hai biến trống là mẫu công khai.
.env.local của từng máy chứa giá trị thật và đã được gitignore. Tài liệu này không
đọc/chép lại .env.local. Tiền tố EXPO_PUBLIC_ nghĩa là giá trị có thể đi vào bundle
ứng dụng, không biến nó thành bí mật. Do đó chỉ dùng URL/publishable key ở đây.

### package.json

Trong phần Auth, mình ghim Supabase JS ở phiên bản 2.118.0 và thêm script
`test: node --test tests/*.test.mjs`. Node chạy các file test, không chạy app điện thoại.
Các thư viện React Hook Form, Zod, resolver, AsyncStorage và URL polyfill đã được
cài trong giai đoạn môi trường. package-lock.json khóa dependency để npm ci tái tạo.
Không cần học từng dependency lồng trong lockfile để hiểu luồng Auth.

### .github/workflows/ci.yml

```yaml
name: Checks
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build:web
```

Workflow tên Checks được kích hoạt bởi push/pull_request. Nó chạy trên Ubuntu,
checkout code, chọn Node từ .nvmrc và cache npm, cài theo lockfile, chạy test,
typecheck, lint rồi export web. Trong giai đoạn Auth mình bổ sung bước npm test.

CI này kiểm tra code và bundle; không chứng minh mail tới hộp thư thật và chưa
kiểm thử giao diện trên điện thoại. Nó cũng không triển khai backend hay tự publish APK.

### Các tài liệu khác

- README.md: lệnh chạy nhanh, phạm vi hiện đã có và ngôn ngữ giao diện.
- docs/SETUP.md: yêu cầu máy, chạy Expo, xử lý chứng chỉ npm và EAS.
- docs/AUTH.md: thiết lập email và checklist nghiệm thu Auth.
- supabase/README.md: vị trí cấu hình client, nguyên tắc không đưa secret vào app.
- docs/superpowers/plans/2026-10-28-email-auth.md: kế hoạch/kết quả thực hiện milestone.

Các file docs không được import vào app. File mẫu Expo như explore.tsx, app-tabs,
animated-icon không thuộc luồng Auth mới. Chúng không phải các màn hình booking đã làm.

## 14. Theo dấu một người dùng qua đủ 5 tình huống

### A. Mở app lần đầu

_layout bọc Stack trong AuthProvider. Provider có loading. Index hiện spinner.
Watcher gọi getSession; thiết bị chưa có phiên nên nhận null và không có lỗi.
Provider đổi thành ready/null; Index dựng AuthScreen; mode ban đầu login.

### B. Đăng ký tài khoản

Bấm Create an account → AuthScreen đổi mode → RegisterForm được dựng.
Gõ bốn ô → Controller cập nhật useForm. Bấm Create account → handleSubmit kiểm tra
Zod. Sai thì báo tại ô. Đúng thì gọi service register → SDK signUp → server.
Nếu chưa có session: kết quả confirmation → đổi mode verify và bàn giao email.
Máy chủ gửi thư theo cấu hình SMTP/template; app không thể ép thư đến thành công.

### C. Nhập đúng mã

Gõ mã → submit xác nhận → verificationSchema → service verify → SDK verifyOtp.
Server kiểm tra và cấp session. SDK lưu phiên và phát sự kiện. Watcher báo session
→ Provider ready/session → Index chọn AccountScreen. UI hiển thị tên/email từ session.
Form không phải tự lưu access token hay tự tạo user bằng một biến boolean.

### D. Đóng app rồi mở lại

React state cũ mất khi tiến trình bị đóng. Lần khởi động mới vẫn bắt đầu loading.
SDK đọc phiên đã lưu trong storage, làm mới khi cần/có thể. Watcher nhận kết quả,
Provider đưa phiên cho UI. Nếu SDK không thể phục hồi và báo lỗi thì hiện Retry;
nếu kết luận không còn phiên hợp lệ thì login. Lưu phiên không có nghĩa đăng nhập
vĩnh viễn, và không có nghĩa mọi thao tác đặt vé đều làm được khi offline.

### E. Đăng xuất

Bấm Sign out → AccountScreen bật busy → service logout → SDK signOut local.
SDK xử lý phiên và phát SIGNED_OUT; watcher báo null → Provider ready/null →
Index dựng AuthScreen mới với mode login. Không tự gọi xóa toàn bộ storage app.

## 15. Trạng thái hiện tại và cách tự kiểm tra hiểu code

Lần review trước tài liệu này: 17 test qua, TypeScript và ESLint qua. Một lỗi UI
gửi lại mã đồng thời đã được tái hiện bằng lời gọi giả; chưa được sửa trong snapshot này.
SMTP/template và luồng email thật vẫn cần nghiệm thu. Quên mật khẩu, profiles,
admin và database đặt vé chưa thuộc phần code Auth hiện tại.

Để tự kiểm tra đã nắm được luồng, thử trả lời các câu sau bằng chính file nguồn:

1. Vì sao login thành công mà LoginForm không gọi router.push?
2. Vì sao chưa có session lúc đầu chưa chắc là người dùng đã đăng xuất?
3. Ai kiểm tra confirmPassword và nó có được gửi lên server không?
4. Ai quyết định mã email đã hết hạn: Zod hay Supabase?
5. Vì sao sửa một biến thường không đủ để React cập nhật màn hình?
6. Vì sao có session hiển thị trên app vẫn phải có RLS cho bảng bookings?
7. Đoạn nào ngăn phản hồi getSession cũ ghi đè sự kiện đăng xuất mới?

Đáp án đều nằm trong các phần trên. Khi gặp đoạn khó, mở nguyên file tương ứng,
xem đầu vào/đầu ra trước, rồi theo dấu một lần bấm nút thay vì học thuộc mọi tên biến.

## Tài liệu chính thức để đọc thêm

- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/reference/javascript/auth-getsession
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://supabase.com/docs/reference/javascript/auth-signout
- https://react.dev/learn/state-a-components-memory
- https://react.dev/reference/react/useEffect
- https://react-hook-form.com/docs/useform
