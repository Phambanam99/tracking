# Báo Cáo Đánh Giá Bảo Mật Toàn Diện

## Tracking Application - Backend & Frontend

**Ngày đánh giá:** 18/11/2025  
**Phạm vi:** Full-stack application (NestJS Backend + Next.js Frontend)

---

## 📊 Tóm Tắt Executive Summary

### Điểm Bảo Mật Tổng Thể: **6.5/10** ⚠️

| Hạng Mục                       | Điểm | Mức Độ           |
| ------------------------------ | ---- | ---------------- |
| Authentication & Authorization | 7/10 | 🟡 Trung Bình    |
| Secrets Management             | 3/10 | 🔴 Nguy Hiểm     |
| Input Validation               | 7/10 | 🟡 Trung Bình    |
| API Security                   | 6/10 | 🟡 Trung Bình    |
| Data Protection                | 5/10 | 🟠 Cần Cải Thiện |
| Session Management             | 6/10 | 🟡 Trung Bình    |
| Rate Limiting                  | 4/10 | 🟠 Cần Cải Thiện |
| CORS & Headers                 | 8/10 | 🟢 Tốt           |
| Error Handling                 | 7/10 | 🟡 Trung Bình    |
| Dependencies                   | ?/10 | ⚪ Chưa Kiểm Tra |

---

## 🚨 VẤN ĐỀ NGHIÊM TRỌNG (CRITICAL) - Cần Fix Ngay

### 1. **SECRETS EXPOSURE - File .env Bị Commit** 🔴 CRITICAL

**Vị trí:** `backend/.env`

**Vấn đề:**

```dotenv
# ❌ NGUY HIỂM - Secrets bị expose trong repository
DATABASE_URL="postgresql://admin:Phamnam99@localhost:5432/tracking?schema=public"
JWT_SECRET=your-super-secret-jwt-key-here
AI_STREAM_API="89feca5a66015a869401e8911866b85dc6690666"
MARINETRAFFIC_ACCESS_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIs..."
OPENWEATHER_API_KEY=6b33f16dae3587630c60ee15fcb0b4e4
```

**Nguy cơ:**

- ✅ Database credentials EXPOSED (username: admin, password: Phamnam99)
- ✅ JWT secret quá đơn giản và bị hardcode
- ✅ API keys bị lộ publicly
- ✅ Access tokens có thể bị lợi dụng
- ✅ Nếu push lên GitHub public → **TẤT CẢ bị lộ cho toàn bộ internet**

**Tác động:**

- Attacker có thể:
  - Truy cập trực tiếp vào database
  - Forge JWT tokens để impersonate users
  - Sử dụng API keys của bạn (cost money!)
  - Truy cập unauthorized data

**Giải pháp:**

```bash
# 1. Remove .env from git history (URGENT!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Add to .gitignore
echo "*.env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# 3. Rotate ALL secrets immediately
# - Change database password
# - Generate new JWT secret (min 32 chars)
# - Revoke and regenerate API keys

# 4. Use environment-specific .env templates
cp backend/.env backend/.env.example
# Remove all real values from .env.example
```

**Best Practices:**

```dotenv
# .env.example (safe to commit)
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
JWT_SECRET="generate-using-openssl-rand-base64-32"
AI_STREAM_API="your-api-key-here"
```

---

### 2. **WEAK JWT SECRET** 🔴 CRITICAL

**Vị trí:** `backend/.env` line 28

**Vấn đề:**

```dotenv
JWT_SECRET=your-super-secret-jwt-key-here  # ❌ Quá đơn giản, dễ crack
```

**Nguy cơ:**

- JWT secret chỉ là string đơn giản, không đủ entropy
- Dễ bị brute force attack
- Nếu bị crack → toàn bộ authentication bị compromised

**Giải pháp:**

```bash
# Generate strong JWT secret (256-bit)
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Result example:
# JWT_SECRET=Xj7+9k3mP2vL8qB4nF6wR1yT5hG0cA9sD2fE7zU4iK8=
```

---

### 3. **NO RATE LIMITING ON AUTH ENDPOINTS** 🔴 CRITICAL

**Vị trí:** `backend/src/auth/auth.controller.ts`

**Vấn đề:**

- Login endpoint KHÔNG có rate limiting
- Cho phép unlimited brute force attacks
- Không có account lockout mechanism

**Công kích:**

```bash
# Attacker có thể brute force passwords
for i in {1..10000}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password'$i'"}'
done
```

**Giải pháp:**

```typescript
// Install @nestjs/throttler
npm install @nestjs/throttler

// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 5, // 5 requests per 60 seconds
    }),
  ],
})

// auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Throttle(5, 60) // Max 5 login attempts per minute
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    // ...
  }
}
```

---

### 4. **INSUFFICIENT PASSWORD HASHING ROUNDS** 🟠 HIGH

**Vị trí:** `backend/src/user/user.service.ts` line 21

**Vấn đề:**

```typescript
const hashedPassword = await bcrypt.hash(data.password, 12); // ❌ 12 rounds có thể không đủ
```

**Phân tích:**

- bcrypt rounds=12 là acceptable nhưng không optimal cho 2025
- Với GPU hiện đại, 12 rounds có thể bị crack trong vài giờ
- Industry standard hiện tại: 12-14 rounds (tùy use case)

**Giải pháp:**

```typescript
// Increase to 13-14 rounds for better security
const BCRYPT_ROUNDS = 13;
const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

// Performance test different rounds:
// - 10 rounds: ~10ms per hash
// - 12 rounds: ~40ms per hash  ✓ Current
// - 13 rounds: ~80ms per hash  ✓ Recommended
// - 14 rounds: ~160ms per hash ✓ High security
```

---

### 5. **NO PASSWORD COMPLEXITY REQUIREMENTS** 🟠 HIGH

**Vị trí:** `backend/src/auth/dto/auth.dto.ts`

**Vấn đề:**

- Không có validation cho password strength
- Cho phép weak passwords như "123456"
- Không có minimum length enforcement

**Hiện tại:**

```typescript
// ❌ Không có validation
@IsString()
@MinLength(6) // Quá ngắn!
password: string;
```

**Giải pháp:**

```typescript
import { IsStrongPassword } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(12, { message: "Password must be at least 12 characters" })
  @IsStrongPassword(
    {
      minLength: 12,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        "Password must contain: uppercase, lowercase, number, and symbol",
    }
  )
  password: string;
}
```

---

## 🟡 VẤN ĐỀ CẦN KHẮC PHỤC (HIGH)

### 6. **SQL INJECTION RISK - Prisma ORM** 🟡 MEDIUM (Monitored)

**Vị trí:** Toàn bộ backend sử dụng Prisma

**Phân tích:**

- ✅ **Tốt**: Sử dụng Prisma ORM (provides protection)
- ✅ **Tốt**: Không thấy raw SQL queries
- ⚠️ **Cần kiểm tra**: Dynamic query building

**Ví dụ an toàn:**

```typescript
// ✓ Safe - Prisma parameterized queries
const vessels = await this.prisma.vessel.findMany({
  where: { mmsi: userInput }, // Prisma handles sanitization
});
```

**Nguy hiểm nếu:**

```typescript
// ❌ DANGEROUS - Raw SQL with string concatenation
await this.prisma.$executeRaw(`
  SELECT * FROM vessels WHERE mmsi = '${userInput}'
`); // SQL injection vulnerable!

// ✓ Safe alternative
await this.prisma.$executeRaw`
  SELECT * FROM vessels WHERE mmsi = ${userInput}
`; // Template literal = safe
```

**Khuyến nghị:** Audit all `$executeRaw` và `$queryRaw` calls

---

### 7. **XSS PREVENTION - Frontend** 🟢 GOOD (React Default)

**Vị trí:** Frontend Next.js/React

**Phân tích:**

- ✅ React automatically escapes content
- ✅ Không tìm thấy `dangerouslySetInnerHTML`
- ✅ Không có direct DOM manipulation với user input

**Lưu ý:**

```typescript
// ❌ NEVER do this with user input
<div dangerouslySetInnerHTML={{__html: userInput}} />

// ✓ Safe - React auto-escapes
<div>{userInput}</div>
```

---

### 8. **SESSION TOKEN STORAGE - Frontend** 🟡 MEDIUM

**Vị trí:** `frontend/src/stores/authStore.ts` line 47

**Vấn đề:**

```typescript
// ⚠️ Storing JWT in cookies without httpOnly flag
document.cookie = `token=${data.access_token}; path=/; max-age=${
  7 * 24 * 60 * 60
}; SameSite=Lax`;
```

**Nguy cơ:**

- Cookie KHÔNG có `httpOnly` flag → vulnerable to XSS
- Nếu có XSS vulnerability, attacker có thể steal token
- JavaScript có thể access cookie → risk

**Giải pháp:**

**Option 1: Server-side cookie (Recommended)**

```typescript
// Backend sets httpOnly cookie
@Post('login')
async login(@Request() req, @Res({ passthrough: true }) response: Response) {
  const result = await this.authService.login(req.user);

  // Set httpOnly cookie (không thể access từ JavaScript)
  response.cookie('token', result.access_token, {
    httpOnly: true,     // ✓ Prevent XSS
    secure: true,       // ✓ HTTPS only
    sameSite: 'strict', // ✓ CSRF protection
    maxAge: 3600000,    // 1 hour
  });

  return { user: result.user }; // Don't send token in body
}
```

**Option 2: In-memory storage (Most secure)**

```typescript
// Store token in memory only (lost on refresh)
const useAuthStore = create<AuthState>((set) => ({
  token: null, // Never persisted
  // ...
}));

// Trade-off: User must login after each page refresh
// But: Most secure against XSS
```

---

### 9. **CORS CONFIGURATION** 🟢 GOOD but Can Improve

**Vị trí:** `backend/src/main.ts` line 37

**Hiện tại:**

```typescript
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:4000")
  .split(",")
  .map((s) => s.trim());

app.enableCors({
  origin: allowedOrigins, // ✓ Configurable
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // ✓ Good for cookies
});
```

**Đánh giá:**

- ✅ CORS được config từ environment
- ✅ Credentials enabled (needed for cookies)
- ⚠️ Methods: quá rộng, có DELETE

**Cải thiện:**

```typescript
app.enableCors({
  origin: (origin, callback) => {
    // Validate origin more strictly
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH"], // Remove DELETE if not needed
  credentials: true,
  maxAge: 86400, // Cache preflight for 24h
});
```

---

### 10. **HELMET CONFIGURATION** 🟢 GOOD but Basic

**Vị trí:** `backend/src/main.ts` line 47

**Hiện tại:**

```typescript
app.use(helmet()); // ✓ Basic protection
```

**Cải thiện:**

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "deny",
    },
    noSniff: true,
    xssFilter: true,
  })
);
```

---

### 11. **API ENDPOINT AUTHORIZATION** 🟡 MIXED

**Phân tích:**

**✅ Protected endpoints (Good):**

```typescript
// vessel.controller.ts
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Delete(':id')
async deleteVessel() // ✓ Requires auth + admin role
```

**⚠️ Potentially open endpoints:**

```typescript
// vessel.controller.ts
@Get('online')
async getOnlineVessels() // ❌ No guards - publicly accessible
```

**Rủi ro:**

- Sensitive data có thể bị exposed without authentication
- No rate limiting on public endpoints
- Potential data scraping

**Khuyến nghị:**

```typescript
// Add authentication to sensitive endpoints
@UseGuards(AuthGuard)
@Throttle(20, 60) // Rate limit public endpoints
@Get('online')
async getOnlineVessels()
```

---

### 12. **ERROR INFORMATION DISCLOSURE** 🟡 MEDIUM

**Vị trí:** `backend/src/common/filters/http-exception.filter.ts`

**Vấn đề:**

```typescript
response.status(status).json({
  success: false,
  error: typeof message === "string" ? { message } : message, // ⚠️ May leak stack trace
  path: request?.url, // ⚠️ Exposes internal paths
  timestamp: new Date().toISOString(),
});
```

**Nguy cơ:**

- Error messages có thể chứa sensitive info
- Stack traces leak code structure
- Internal paths exposed

**Giải pháp:**

```typescript
const isDevelopment = process.env.NODE_ENV === "development";

response.status(status).json({
  success: false,
  message: isDevelopment
    ? typeof message === "string"
      ? message
      : message.message
    : "An error occurred", // Generic message in production
  ...(isDevelopment && {
    error: message,
    path: request?.url,
    stack: exception instanceof Error ? exception.stack : undefined,
  }),
  timestamp: new Date().toISOString(),
});
```

---

### 13. **DATABASE CONNECTION STRING EXPOSURE** 🔴 CRITICAL

**Vị trí:** `backend/.env` line 1

**Vấn đề:**

```dotenv
DATABASE_URL="postgresql://admin:Phamnam99@localhost:5432/tracking?schema=public"
#                         ^^^^^^ ^^^^^^^^^
#                         Username và password hardcoded!
```

**Giải pháp:**

```dotenv
# Use separate env vars
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tracking
DB_USER=admin
DB_PASSWORD=${VAULT_DB_PASSWORD} # From secret manager

# Or use connection pooler
DATABASE_URL="postgresql://admin:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
```

---

### 14. **NO INPUT SANITIZATION FOR LOGS** 🟡 MEDIUM

**Vị trí:** Multiple logger calls

**Vấn đề:**

```typescript
this.logger.log(`Processing MMSI ${queueItem.mmsi}`);
// ⚠️ If mmsi contains malicious content, could pollute logs
```

**Log injection attack:**

```
mmsi = "123456\n[CRITICAL] System compromised!\n"
// Logs will show fake critical alert
```

**Giải pháp:**

```typescript
// Sanitize before logging
private sanitizeForLog(input: string): string {
  return input.replace(/[\r\n\t]/g, ' ').substring(0, 100);
}

this.logger.log(`Processing MMSI ${this.sanitizeForLog(queueItem.mmsi)}`);
```

---

## 🟢 ĐIỂM TỐT (GOOD PRACTICES)

### ✅ 1. **Password Hashing với bcrypt**

```typescript
const hashedPassword = await bcrypt.hash(data.password, 12); // ✓ Not stored in plaintext
```

### ✅ 2. **JWT Expiration**

```typescript
const accessToken = this.jwtService.sign(payload, { expiresIn: "1h" }); // ✓ Short-lived
const refreshToken = this.jwtService.sign(payload, { expiresIn: "7d" }); // ✓ Separate refresh
```

### ✅ 3. **Input Validation với class-validator**

```typescript
@IsString()
@IsEmail()
@MinLength(6)
// ✓ Comprehensive validation
```

### ✅ 4. **Prisma ORM (SQL Injection Protection)**

```typescript
// ✓ Parameterized queries by default
const user = await this.prisma.user.findUnique({ where: { id } });
```

### ✅ 5. **Session Tracking**

```typescript
// ✓ Store sessions in database
await this.userService.createSession(
  user.id,
  accessToken,
  refreshToken,
  expiresAt
);
```

### ✅ 6. **Role-Based Access Control (RBAC)**

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // ✓ Fine-grained permissions
```

### ✅ 7. **Helmet Security Headers**

```typescript
app.use(helmet()); // ✓ HSTS, XSS protection, etc.
```

### ✅ 8. **Environment-based Configuration**

```typescript
const config = this.configService.get<string>("API_KEY"); // ✓ Not hardcoded
```

---

## 📋 CHECKLIST KHẮC PHỤC

### 🔴 URGENT (Trong 24h)

- [ ] **Remove .env from git history**
- [ ] **Rotate tất cả secrets:**
  - [ ] Database password
  - [ ] JWT secret (generate new 32+ char)
  - [ ] API keys (revoke & regenerate)
- [ ] **Add .env to .gitignore**
- [ ] **Implement rate limiting on /auth endpoints**
- [ ] **Add httpOnly cookie for JWT tokens**

### 🟠 HIGH PRIORITY (Trong tuần)

- [ ] **Implement password complexity requirements**
- [ ] **Increase bcrypt rounds to 13**
- [ ] **Add authentication to sensitive endpoints**
- [ ] **Implement account lockout after failed attempts**
- [ ] **Add CAPTCHA to login after 3 failed attempts**
- [ ] **Audit all Prisma raw queries**
- [ ] **Improve error messages (hide stack traces in production)**

### 🟡 MEDIUM PRIORITY (Trong tháng)

- [ ] **Implement refresh token rotation**
- [ ] **Add security headers (CSP, etc.)**
- [ ] **Implement audit logging for admin actions**
- [ ] **Add input sanitization for logs**
- [ ] **Set up dependency scanning (npm audit, Snyk)**
- [ ] **Implement session timeout warnings**
- [ ] **Add 2FA support**

### 🟢 LOW PRIORITY (Nice to have)

- [ ] **Implement OAuth2 login (Google, GitHub)**
- [ ] **Add security.txt file**
- [ ] **Implement API versioning sunset policy**
- [ ] **Add honeypot fields to forms**
- [ ] **Implement rate limiting per user**

---

## 🛡️ BẢO MẬT THEO OWASP TOP 10 (2021)

| OWASP Risk                               | Status      | Notes                                     |
| ---------------------------------------- | ----------- | ----------------------------------------- |
| A01:2021 – Broken Access Control         | 🟡 Partial  | RBAC implemented, but missing rate limits |
| A02:2021 – Cryptographic Failures        | 🔴 Critical | Secrets in .env, weak JWT secret          |
| A03:2021 – Injection                     | 🟢 Good     | Prisma ORM protects against SQL injection |
| A04:2021 – Insecure Design               | 🟡 Medium   | No rate limiting, weak password policy    |
| A05:2021 – Security Misconfiguration     | 🟠 High     | .env committed, basic helmet config       |
| A06:2021 – Vulnerable Components         | ⚪ Unknown  | Need npm audit                            |
| A07:2021 – Identification/Authentication | 🟡 Medium   | JWT implemented, but cookie not httpOnly  |
| A08:2021 – Software/Data Integrity       | 🟢 Good     | Using npm, but need integrity checks      |
| A09:2021 – Security Logging/Monitoring   | 🟡 Medium   | Basic logging, need security events       |
| A10:2021 – Server-Side Request Forgery   | 🟢 Low Risk | No SSRF patterns detected                 |

---

## 🔧 TOOLS KHUYẾN NGHỊ

### Security Scanning

```bash
# 1. Dependencies vulnerabilities
npm audit
npm audit fix

# 2. Static analysis
npm install -g eslint-plugin-security
npx eslint-plugin-security

# 3. Secrets scanning
npm install -g truffleHog
truffleHog --regex --entropy=False .

# 4. Container scanning (if using Docker)
docker scan your-image-name
```

### Continuous Monitoring

```bash
# Snyk (free for open source)
npm install -g snyk
snyk test
snyk monitor

# GitHub Dependabot (free)
# Enable in repository settings
```

---

## 📚 TÀI LIỆU THAM KHẢO

1. **OWASP Top 10:** https://owasp.org/www-project-top-ten/
2. **JWT Best Practices:** https://tools.ietf.org/html/rfc8725
3. **NestJS Security:** https://docs.nestjs.com/security/encryption-and-hashing
4. **Next.js Security:** https://nextjs.org/docs/advanced-features/security-headers

---

## 🎯 KẾT LUẬN

### Điểm Mạnh

- ✅ Architecture tổng thể tốt với NestJS + Prisma
- ✅ Có authentication và RBAC
- ✅ Sử dụng bcrypt cho passwords
- ✅ Input validation với class-validator

### Điểm Yếu Nghiêm Trọng

- 🔴 Secrets bị expose trong .env file
- 🔴 Không có rate limiting
- 🔴 JWT secret yếu
- 🟠 Cookie không httpOnly
- 🟠 Password policy yếu

### Hành Động Ưu Tiên Cao Nhất

1. **Remove .env from git IMMEDIATELY**
2. **Rotate all secrets**
3. **Implement rate limiting**
4. **Fix JWT cookie security**
5. **Add password complexity**

### Đánh Giá Cuối Cùng

Application có **foundation tốt** nhưng cần khắc phục **các lỗ hổng critical** trước khi deploy production. Với các fix được đề xuất, security score có thể tăng lên **8-9/10**.

---

**⚠️ DISCLAIMER:** Đây là security audit cơ bản. Để có đánh giá toàn diện hơn, khuyến nghị thực hiện penetration testing bởi security professionals.

**Next Steps:**

1. Fix critical issues (ngay lập tức)
2. Implement high priority items (trong tuần)
3. Schedule penetration testing
4. Set up continuous security monitoring
