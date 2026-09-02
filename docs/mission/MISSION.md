# مأموریت مستقل Coding Studio — Frontend Completion با Finn Loop

> این سند، متن کامل و بدون حذف مأموریت است که در مخزن ذخیره شده تا هیچ خطی از آن فراموش یا گم نشود.
> منبع حقیقت برای دامنه کار، معیارهای پذیرش و قوانین اجرا همین فایل است.
> فایل همراه: `docs/mission/PROGRESS.md` (لیست شماره‌گذاری‌شده مراحل و درصد پیشرفت).

این دستور یک مأموریت اجرایی کامل و خودگردان است. آن را از ابتدا تا انتها انجام بده و برای تصمیم‌های معمول توسعه، طراحی، تست، refactor، نام‌گذاری، ساختار فایل‌ها و رفع خطا منتظر پاسخ من نمان.

هدف این مرحله:

1. تغییر معماری محصول از Ollama به معماری جدید.
2. حذف کامل Ollama از Coding Studio.
3. تکمیل Frontend در سطح یک محصول حرفه‌ای Windows.
4. استفاده از Mock Runtime مستقل از Provider.
5. آماده‌سازی قراردادهای Frontend برای اتصال آینده به Jcode.
6. اجرای فرایند توسعه با یک Finn Loop دقیق شامل:
   Discover → Specify → Plan → Implement → Test → Review → Fix → Verify → Document → Commit → Push → CI Review
7. ادامه خودکار چرخه تا زمانی که تمام معیارهای پذیرش برآورده و CI سبز شود.
8. در این مرحله Jcode، Ruflo، Soup و OmniRoute را واقعاً یکپارچه نکن.

---

# 1. معماری نهایی و قطعی محصول

معماری نهایی Coding Studio به این شکل است:

- Core coding runtime: Jcode
- Advanced multi-agent orchestrator: Ruflo
- Future skill router: Soup
- Future provider router: OmniRoute
- Desktop platform: Tauri + React
- AI providers:
  - Claude
  - OpenAI / Codex
  - Gemini
  - GitHub Copilot
  - Custom OpenAI-compatible providers
- Ollama: حذف کامل و دائمی

معماری آینده:

```
React UI
    ↓
Typed StudioRuntimeBridge
    ↓
Tauri IPC
    ↓
Rust Process Supervisor
    ↓
Jcode
    ↓
Claude / Codex / Gemini / GitHub Copilot
```

Ruflo در آینده به‌عنوان قابلیت اختیاری Advanced Swarm روی این معماری اضافه خواهد شد.

در این مأموریت فقط این قسمت اجرا شود:

```
React UI
    ↓
Typed StudioRuntimeBridge
    ↓
MockStudioRuntime
```

Frontend نباید به Jcode، Ruflo، Claude، OpenAI، Gemini، Copilot یا هیچ API واقعی متصل شود.

---

# 2. اطلاعات Git و Pull Request

Repository:

`yousefghorbanian98-create/Coding-Studio`

Pull Request فعلی:

PR #1

Branch مورد انتظار نشست:

`arena/01a060ce-coding-studio`

آخرین commit شناخته‌شده قبل از شروع این مأموریت:

`9e516df4c3d21c9dde5a760b55c75c91cc93deb7`

قوانین Git:

1. ابتدا با `git branch --show-current` شاخه را بررسی کن.
2. فقط روی شاخه اختصاص‌یافته همین نشست کار کن.
3. شاخه جدید نساز.
4. به `main` مستقیم push نکن.
5. force push نکن.
6. history را بازنویسی نکن.
7. PR #1 را Merge نکن.
8. PR #1 را تا پایان تست دستی همچنان Draft نگه دار.
9. PR را بدون دستور صریح من Ready for Review نکن.
10. تغییرات را در commitهای کوچک، معنادار و قابل بررسی ثبت کن.
11. بعد از هر Slice کامل و سبز، روی همان شاخه push کن.
12. در صورت وجود تغییرات قبلی، آن‌ها را بدون بررسی overwrite یا discard نکن.
13. هیچ فایل کاربر یا تغییر unrelated را حذف نکن.
14. از `git reset --hard`، `git clean -fd` و عملیات مخرب استفاده نکن.
15. قبل و بعد از هر مرحله مهم، `git status --short` را بررسی کن.

عنوان پیشنهادی جدید PR:

`Frontend Foundation — Complete provider-neutral agent workspace`

توضیحات PR باید صادقانه بیان کند که Jcode و Providerهای واقعی هنوز یکپارچه نشده‌اند و تمام رفتارهای Agent در این مرحله Mock هستند.

---

# 3. نحوه استفاده از Finn Loop

از الگوی کاری Finn Loop به‌عنوان چرخه اصلی توسعه استفاده کن.

اگر Finn Loop از قبل در Repository یا محیط نشست نصب یا تنظیم شده است، از همان نسخه و مستندات موجود استفاده کن.

اگر نصب نشده است:

1. ابتدا مخزن رسمی Finn Loop و مستندات فعلی آن را فقط برای شناخت Workflow بررسی کن.
2. آن را بدون بررسی امنیتی و مجوزها وارد سورس محصول نکن.
3. کد Finn Loop را داخل Coding Studio vendor نکن.
4. Finn Loop را runtime dependency محصول نکن.
5. اگر Linear connector یا credential آن در محیط موجود نیست، متوقف نشو و از من credential درخواست نکن.
6. در نبود Linear، همان چرخه Spec → Build → Review را با GitHub Issues، PR checklist و فایل‌های Markdown داخل Repository اجرا کن.
7. GitHub PR منبع اصلی گزارش پیشرفت باشد.
8. برای اجرای Frontend از سرویس پولی یا API Key واقعی استفاده نکن.

چرخه هر Slice:

**A. DISCOVER**
- سورس فعلی را بررسی کن.
- کامپوننت‌ها، routeها، state management، تست‌ها، Tauri commands و وابستگی‌ها را شناسایی کن.
- مشخص کن چه چیزی قابل حفظ، refactor یا حذف است.
- قبل از تغییر، baseline tests را اجرا کن.
- اگر baseline از قبل خراب است، خرابی را مستند کن و سپس اصلاحش کن.

**B. SPECIFY**
- هدف Slice را به معیارهای قابل آزمایش تبدیل کن.
- رفتارهای UI، حالت‌های خطا، تعاملات صفحه‌کلید و accessibility را مشخص کن.
- قراردادهای TypeScript مربوط را قبل از Implementation تعریف کن.

**C. PLAN**
- فایل‌های مورد تغییر را مشخص کن.
- کم‌ریسک‌ترین مسیر پیاده‌سازی را انتخاب کن.
- از rewrite گسترده در صورت امکان پرهیز کن.
- وابستگی جدید فقط در صورت ضرورت واقعی اضافه کن.

**D. IMPLEMENT**
- Slice را کامل و production-quality پیاده‌سازی کن.
- از placeholderهای دروغین، دکمه‌های بدون عملکرد و TODOهای مبهم پرهیز کن.
- رفتار Mock باید deterministic و قابل تست باشد.

**E. TEST**
- TypeScript typecheck
- lint
- unit tests
- component tests در صورت وجود
- Playwright
- Rust/Tauri checks در حد قابل اجرا
- production build
- Windows CI

**F. REVIEW**
در نقش‌های جداگانه تغییرات را بازبینی کن:

- Product reviewer
- UX reviewer
- Accessibility reviewer
- TypeScript reviewer
- Tauri/security reviewer
- Test reviewer
- Performance reviewer

**G. FIX**
- تمام ایرادهای مهم و متوسط Review را اصلاح کن.
- مشکلات cosmetic کوچک را در صورتی که کم‌ریسک‌اند اصلاح کن.
- تست رگرسیون برای bugهای واقعی اضافه کن.

**H. VERIFY**
- تمام تست‌های مرتبط را دوباره اجرا کن.
- UI را در viewportهای هدف بررسی کن.
- screenshotها را کنترل کن.
- console error و unhandled rejection نباید وجود داشته باشد.

**I. DOCUMENT**
- معماری و تصمیمات مهم را مختصر و دقیق به‌روزرسانی کن.
- از مستندات تکراری و حجیم پرهیز کن.
- PR checklist را به‌روز کن.

**J. COMMIT AND PUSH**
- فقط وقتی Slice کامل و تست‌های مرتبط سبز است commit کن.
- commit message معنادار بنویس.
- به شاخه همین نشست push کن.
- وضعیت CI را بررسی کن.

**K. CI REVIEW**
- اگر CI شکست خورد، log واقعی را بخوان.
- علت ریشه‌ای را اصلاح کن؛ تست را حذف یا بی‌اثر نکن.
- دوباره push و بررسی کن.
- تا پنج چرخه رفع CI را خودکار ادامه بده.
- اگر بعد از پنج چرخه مشکل خارجی یا غیرقابل‌حل باقی ماند، با شواهد کامل گزارش بده.

سپس Slice بعدی را بدون سؤال از من شروع کن.

---

# 4. سطح اختیار خودکار

برای موارد زیر نیازی به سؤال از من نیست:

- ایجاد و ویرایش فایل‌های داخل Repository
- refactor محدود و مرتبط
- ایجاد component، hook، schema و test
- نصب dependency ضروری و معتبر
- حذف dependency بلااستفاده و مرتبط
- اجرای test/build/lint
- اصلاح CI
- commit و push به شاخه همین نشست
- به‌روزرسانی Draft PR
- تصمیم‌های معمول UI و UX
- نام‌گذاری داخلی
- اصلاح accessibility
- بهینه‌سازی performance
- اضافه‌کردن screenshot tests
- تغییر mock fixtures
- حذف کد Ollama
- تغییر عنوان و توضیحات Draft PR

برای موارد زیر اقدام نکن و در صورت نیاز متوقف شو:

- Merge کردن PR
- Ready for Review کردن PR
- push به main
- force push
- انتشار Release عمومی
- خرید سرویس
- ایجاد هزینه API
- درخواست یا ذخیره API Key
- درخواست password، token یا 2FA
- تغییر Repository visibility
- تغییر تنظیمات امنیتی حساب GitHub
- حذف Repository
- عملیات مخرب روی داده‌های خارج از Repository
- غیرفعال‌کردن تست‌ها برای سبزکردن ظاهری CI

اگر GitHub authentication شکست خورد، فقط گزارش بده که اتصال GitHub در Arena باید reconnect شود. هیچ credentialی از من درخواست نکن.

---

# 5. مرحله صفر — Audit و Baseline

قبل از پیاده‌سازی:

1. ساختار کامل Repository را بررسی کن.
2. `package.json` و lockfile را بررسی کن.
3. تنظیمات Vite، React، TypeScript، Playwright و Tauri را بررسی کن.
4. مسیرهای Ollama را شناسایی کن.
5. تمام متن‌ها و identifierهای مربوط به Ollama را پیدا کن.
6. transport abstraction فعلی را بررسی کن.
7. persistence فعلی Session را بررسی کن.
8. mock adapter فعلی را بررسی کن.
9. وضعیت تست‌ها را ثبت کن.
10. وضعیت GitHub Actions را بررسی کن.
11. screenshotها و artifactهای آخرین CI را بررسی کن.
12. یک گزارش کوتاه baseline داخل PR یا فایل برنامه اجرایی ایجاد کن.
13. مشخص کن چه بخش‌هایی حفظ می‌شوند و چه بخش‌هایی حذف یا refactor خواهند شد.

دستورهای جست‌وجوی مورد انتظار:

- جست‌وجوی case-insensitive برای `ollama`
- جست‌وجوی `11434`
- جست‌وجوی `/api/tags`
- جست‌وجوی `/api/chat`
- جست‌وجوی `/api/version`
- جست‌وجوی Tauri commandهای Ollama
- بررسی dependencyهای Rust و TypeScript مرتبط

قبل از شروع تغییرات، تست‌های موجود را اجرا کن و نتیجه baseline را ثبت کن.

---

# 6. Slice 1 — حذف کامل Ollama

Ollama باید از محصول حذف شود.

مواردی که باید حذف یا تبدیل شوند:

- Rust Ollama client
- Ollama adapter
- Ollama endpoint state
- `/api/version`
- `/api/tags`
- `/api/chat`
- `ollama_health`
- `ollama_models`
- `ollama_chat`
- `ollama_set_endpoint`
- Ollama-specific Tauri events
- Ollama-specific Zod schemas
- Ollama model discovery
- Ollama endpoint settings
- Ollama health UI
- Ollama retry UI
- Ollama-specific tests
- Ollama-specific mock responses
- dependencyهای بلااستفاده مربوط به Ollama
- مستندات، screenshotها و متن‌های مربوط به Ollama
- اشاره به `127.0.0.1:11434`

قانون:

بعد از پایان این Slice، جست‌وجوی case-insensitive برای `ollama` در سورس فعال محصول نباید نتیجه‌ای داشته باشد؛ به‌جز در migration note یا history documentation ضروری که به‌وضوح بگوید Ollama حذف شده است. ترجیحاً حتی آن اشاره‌ها نیز خارج از UI و runtime باشند.

کدهای مشترک مفیدی مانند generic cancellation، event streaming یا HTTP-independent state management را در صورت امکان حفظ و provider-neutral کن.

پس از حذف Ollama:

- برنامه باید compile شود.
- Tauri command registration نباید command حذف‌شده داشته باشد.
- warningهای ناشی از import و dead code پاک شوند.
- UI نباید وضعیت جعلی «No models installed» نشان دهد.
- UI باید وضعیت Mock Runtime را به‌درستی نمایش دهد.

Commit پیشنهادی:

`refactor(runtime): remove Ollama and introduce provider-neutral foundation`

---

# 7. Slice 2 — StudioRuntimeBridge

یک abstraction مستقل از Provider طراحی و پیاده‌سازی کن.

رابط مفهومی:

```ts
interface StudioRuntimeBridge {
  getHealth(): Promise<RuntimeHealth>;
  getCapabilities(): Promise<RuntimeCapabilities>;

  listProviders(): Promise<ProviderDescriptor[]>;
  listModels(providerId: string): Promise<ModelDescriptor[]>;

  listSessions(): Promise<SessionSummary[]>;
  createSession(input: CreateSessionInput): Promise<StudioSession>;
  resumeSession(sessionId: string): Promise<StudioSession>;
  renameSession(sessionId: string, title: string): Promise<void>;
  archiveSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  sendMessage(input: SendMessageInput): Promise<RunHandle>;
  cancelRun(runId: string): Promise<void>;

  respondToApproval(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<void>;

  subscribe(
    listener: (event: StudioRuntimeEvent) => void,
  ): () => void;
}
```

این فقط یک قرارداد مفهومی است؛ آن را با conventions فعلی پروژه تطبیق بده و از abstraction غیرضروری پرهیز کن.

الزامات:

1. تمام payloadها TypeScript typed باشند.
2. eventها discriminated union باشند.
3. eventهای ورودی با Zod validate شوند.
4. invalid event برنامه را crash نکند.
5. invalid event به خطای قابل مشاهده و قابل log تبدیل شود.
6. subscription cleanup صحیح باشد.
7. StrictMode باعث listener تکراری نشود.
8. cancellation race condition کنترل شود.
9. eventهای Session اشتباه به Session فعال وارد نشوند.
10. run ID، session ID، task ID، tool call ID و approval ID از هم متمایز باشند.

حداقل eventها:

- `runtime.health_changed`
- `session.created`
- `session.updated`
- `session.archived`
- `run.started`
- `run.cancel_requested`
- `run.cancelled`
- `run.failed`
- `run.completed`
- `message.started`
- `message.delta`
- `message.completed`
- `plan.created`
- `plan.updated`
- `task.created`
- `task.updated`
- `tool.started`
- `tool.output`
- `tool.completed`
- `tool.failed`
- `file.changed`
- `approval.requested`
- `approval.resolved`
- `agent.started`
- `agent.updated`
- `agent.completed`
- `context.updated`
- `notification.created`

MockStudioRuntime باید:

- deterministic باشد.
- timerها را قابل cleanup نگه دارد.
- cancellation واقعی شبیه‌سازی کند.
- reset بین تست‌ها داشته باشد.
- سناریوهای موفق و خطا را پشتیبانی کند.
- dependency مستقیم به componentها نداشته باشد.

Commit پیشنهادی:

`feat(runtime): add typed mock StudioRuntimeBridge`

---

# 8. Slice 3 — Design System و Application Shell

Frontend باید به سطح محصول حرفه‌ای Windows برسد.

اصول طراحی:

- ظاهر حرفه‌ای، فشرده و مناسب ابزار توسعه
- پرهیز از ظاهر generic AI dashboard
- hierarchy واضح
- contrast مناسب
- motion محدود و هدفمند
- عدم استفاده از animation سنگین
- سازگار با سیستم 16GB RAM
- عدم استفاده از WebGL، particle effect و backgroundهای سنگین
- رعایت `prefers-reduced-motion`
- focus state واضح
- keyboard-first interaction
- tooltip برای iconهای بدون label
- hit target مناسب
- متن‌های کوتاه و کاربردی
- عدم استفاده افراطی از gradient
- عدم استفاده از glassmorphism سنگین

ساختار Shell:

- Custom/title bar سازگار با Tauri
- Activity bar
- Primary sidebar
- Main workspace
- Context/right sidebar
- Bottom panel
- Status bar
- Command palette
- Notifications/toasts
- Modal/dialog system
- Resizable panels

Layout باید:

- در `1366×768` بدون شکست کار کند.
- در `1920×1080` از فضای اضافه درست استفاده کند.
- حداقل عرض پنل‌ها را رعایت کند.
- panel size را persist کند.
- باز و بسته‌شدن panelها را persist کند.
- keyboard shortcuts داشته باشد.
- scroll trap ایجاد نکند.
- focus را هنگام باز و بسته‌شدن dialog به‌درستی مدیریت کند.

Activity bar:

- Explorer
- Search
- Source Control
- Sessions
- Agents
- Extensions یا Skills با برچسب Coming later، فقط اگر واقعاً لازم است
- Settings

از دکمه یا navigation بدون عملکرد پرهیز کن. اگر قابلیتی هنوز ساخته نشده، آن را disabled با توضیح روشن نمایش بده یا اصلاً نشان نده.

Commit پیشنهادی:

`feat(shell): complete the resizable desktop workspace`

---

# 9. Slice 4 — Onboarding و Project Home

صفحه شروع باید شامل موارد زیر باشد:

- Open Folder
- Recent Projects
- Clone Repository
- New Session
- Recover Previous Session
- Empty state حرفه‌ای
- نمایش نسخه برنامه
- نمایش Runtime mode
- نمایش واضح Mock/Demo state

در این مرحله عملیات file system واقعی جدید نساز، مگر اینکه abstraction موجود امن و آماده باشد. رفتارهای unavailable باید صادقانه باشند.

نباید وانمود شود Provider واقعی متصل است.

Runtime status:

- Demo Runtime
- Mock Provider
- Ready

Recent projectها:

- نام پروژه
- مسیر خلاصه‌شده
- آخرین زمان استفاده
- branch نمونه
- pin/unpin
- remove from recent
- keyboard navigation

حالت‌ها:

- No recent projects
- Loading
- Loaded
- Permission denied mock
- Missing folder mock
- Recoverable session mock

Commit پیشنهادی:

`feat(onboarding): add project home and recent workspace flows`

---

# 10. Slice 5 — Chat، Composer و Message System

Chat باید از حالت نمونه اولیه خارج شود.

Composer:

- multiline input
- auto-resize با حد منطقی
- ارسال با shortcut استاندارد و قابل کشف
- stop generation
- attach/add context
- `@` file mention UI
- mode selector
- provider selector
- model selector
- context usage indicator
- queue next message
- draft persistence
- disabled state
- validation state
- authentication-required state mock

Modeها:

- Ask
- Plan
- Agent

Message types:

- User
- Assistant
- System status
- Tool call
- Plan
- Approval
- Error
- Cancellation
- Completion summary

Streaming:

- deltaها روان ولی کم‌هزینه render شوند.
- autoscroll فقط وقتی کاربر نزدیک انتهای scroll است.
- اگر کاربر بالا scroll کرد، موقعیت او حفظ شود.
- دکمه Jump to latest نمایش داده شود.
- cancellation بلافاصله UI را به حالت Cancelling و سپس Cancelled ببرد.
- delta بعد از cancellation نباید وارد message شود.
- duplicate final event نباید message را دوباره کامل کند.

Markdown:

- headings
- lists
- links
- inline code
- fenced code
- copy code
- safe rendering
- عدم اجرای HTML ناامن
- long line handling
- syntax highlighting سبک و lazy در صورت امکان

Error states:

- Runtime unavailable
- Authentication required
- Provider unavailable
- Rate limited
- Context limit reached
- Permission denied
- Run failed
- Runtime crashed
- Unknown event
- Cancelled
- Timeout mock

Commit پیشنهادی:

`feat(chat): complete provider-neutral chat and composer experience`

---

# 11. Slice 6 — Plan، Tasks و Agent Timeline

Agent Timeline باید عملیات را ساختاریافته نمایش دهد.

حداقل event cards:

- Thinking
- Reading file
- Searching codebase
- Editing file
- Running command
- Running tests
- Waiting for approval
- Task complete
- Task failed
- Run cancelled

هر Card:

- icon/status
- عنوان کوتاه
- زمان
- duration
- expandable details
- input summary
- output summary
- error details
- copy action در صورت کاربرد
- accessible label

Plan View:

- نمایش مراحل
- Pending
- Running
- Blocked
- Completed
- Failed
- Skip فقط اگر معنا دارد
- Approve plan
- Reject plan
- Edit plan
- Add instruction
- Run step by step
- Run all

Task panel:

- task grouping
- progress
- status filter
- active task highlighting
- blocked reason
- retry mock
- cancel mock

Agent panel:

در این مرحله فقط Mock:

- Primary Agent
- Frontend Agent
- Test Agent
- Reviewer Agent

برای هر Agent:

- role
- status
- current task
- duration
- completed task count
- stop mock
- inspect activity

UI باید برای اتصال آینده Ruflo آماده باشد، ولی هیچ Ruflo code یا dependency اضافه نشود.

Commit پیشنهادی:

`feat(agent-ui): add plans, task tracking, and structured activity`

---

# 12. Slice 7 — Approval Center و Permission UX

Approval types:

- File modification
- Shell command
- Package installation
- Network access
- Git operation
- Delete operation
- Access outside workspace

Actions:

- Approve once
- Approve for session
- Reject
- Edit command، فقط برای shell approval
- View details

الزامات:

- عملیات خطرناک visually distinguish شوند.
- default focus روی امن‌ترین گزینه باشد.
- keyboard navigation کامل باشد.
- Escape رفتار مشخص داشته باشد.
- approval هم در Timeline و هم Approval Center قابل دسترسی باشد.
- resolve شدن approval در همه viewها sync شود.
- approval دو بار resolve نشود.
- stale approval قابل شناسایی باشد.
- approval مربوط به Session دیگر اشتباه نمایش داده نشود.

Permissions settings mock:

- File reads
- File writes
- Terminal commands
- Network requests
- Git commands
- Package installation
- External paths

هیچ «Approve everything forever» ناامن به‌عنوان default ساخته نشود.

Commit پیشنهادی:

`feat(approvals): add safe permission and approval workflows`

---

# 13. Slice 8 — Explorer، Search، Changes و Diff Viewer

Explorer:

- file tree
- folders
- open files
- active file
- modified indicator
- added/deleted/renamed indicator
- context menu
- add to context
- copy relative path
- reveal mock
- collapse all
- keyboard navigation
- loading and empty state

Search:

- query input
- grouped file results
- line preview
- match highlighting
- no results state
- loading state
- error state mock

Changes:

- changed file list
- added
- modified
- deleted
- renamed
- staged/unstaged فقط اگر UI فعلی آن را منطقی می‌کند
- total additions/deletions
- agent attribution mock

Diff Viewer:

- unified view
- split view در صورت عملی بودن و سبک ماندن
- file navigation
- additions/deletions
- accept file mock
- reject file mock
- accept all mock
- revert mock
- copy patch
- long-line handling
- binary-file state mock
- deleted-file state mock
- empty diff state

Monaco را فقط اگر از قبل وجود دارد یا نیاز قطعی دارد استفاده کن. برای این مرحله dependency سنگین جدید صرفاً برای نمایش read-only code اضافه نکن. یک viewer سبک و قابل دسترس ترجیح دارد.

Commit پیشنهادی:

`feat(workspace): add explorer, search, changes, and diff review`

---

# 14. Slice 9 — Bottom Panel

تب‌ها:

- Terminal
- Problems
- Output
- Agent Logs

Terminal در این مرحله Mock است:

- command input demo
- stdout
- stderr
- running state
- success state
- failure state
- cancel mock
- clear
- copy output
- multiple terminal tabs فقط اگر معماری فعلی به‌سادگی پشتیبانی می‌کند

Problems:

- severity
- file
- line/column
- message
- source
- filter
- empty state
- click-to-open mock

Output:

- channel selector
- timestamp
- level
- copy
- clear

Agent Logs:

- structured event list
- filter by run/task/agent
- debug details
- schema-validation errors
- copy diagnostic report

Debug information نباید secret یا credential نمایش دهد.

Commit پیشنهادی:

`feat(panels): complete terminal, problems, output, and runtime logs`

---

# 15. Slice 10 — Session Management

قابلیت‌ها:

- New session
- Rename
- Pin
- Unpin
- Search
- Filter
- Archive
- Restore
- Delete with confirmation
- Resume
- Duplicate
- Session summary
- Last activity
- Provider/model mock metadata
- Draft persistence
- Active session indicator

Persistence:

- از abstraction موجود استفاده کن.
- migration/versioning برای schema در نظر بگیر.
- corrupt data نباید برنامه را crash کند.
- fallback امن ایجاد کن.
- تست hydration اضافه کن.
- تست StrictMode و duplicate initialization اضافه کن.
- session فعال پس از reload بازیابی شود.
- run در حال اجرای Mock پس از reload نباید به‌اشتباه ادامه‌دار نمایش داده شود؛ به حالت Interrupted تبدیل شود.

Commit پیشنهادی:

`feat(sessions): complete persistent session management`

---

# 16. Slice 11 — Settings و Provider-neutral Setup

Settings sections:

- General
- Appearance
- Projects
- Runtime
- Providers
- Models
- Agents
- Permissions
- Memory
- MCP
- Git
- Terminal
- Privacy
- Advanced
- About

فقط بخش‌های لازم را کامل کن و بخش‌های آینده را صادقانه مشخص کن. از ایجاد ده‌ها صفحه خالی پرهیز کن.

Provider Setup UI:

- Claude
- OpenAI / Codex
- Gemini
- GitHub Copilot
- Custom OpenAI-compatible provider

در این مرحله:

- هیچ login واقعی انجام نشود.
- هیچ API key واقعی دریافت نشود.
- هیچ credential در localStorage ذخیره نشود.
- دکمه‌ها باید Demo/Coming in runtime integration را واضح نشان دهند.
- Provider و Model mock قابل انتخاب باشند تا UX تست شود.
- selectorها باید loading، empty، disabled و error state داشته باشند.

Runtime settings:

- Runtime: Mock
- Jcode: Not installed / Future integration
- Ruflo: Optional / Future integration
- Diagnostics
- Event schema version
- Application version

در UI نهایی هیچ اشاره‌ای به Ollama وجود نداشته باشد.

Commit پیشنهادی:

`feat(settings): add provider-neutral setup and diagnostics`

---

# 17. Slice 12 — Command Palette و Keyboard UX

Command Palette:

- Open project
- New session
- Toggle sidebar
- Toggle context panel
- Toggle bottom panel
- Focus composer
- Switch mode
- Open settings
- Open recent session
- Cancel active run
- Show keyboard shortcuts

الزامات:

- fuzzy search مناسب
- keyboard navigation
- focus trap
- restore previous focus
- Escape closes
- Enter activates
- disabled command explanation
- ARIA semantics

Shortcutها نباید با shortcutهای رایج Windows و browser تضاد خطرناک داشته باشند.

یک Keyboard Shortcuts reference کوچک و قابل جست‌وجو ایجاد کن.

Commit پیشنهادی:

`feat(commands): add keyboard-first command navigation`

---

# 18. Slice 13 — Mock Scenario Lab

یک Scenario system برای توسعه و تست بساز.

سناریوهای اجباری:

1. Empty project
2. Recent projects
3. Normal response
4. Long streaming response
5. Code block streaming
6. Plan awaiting approval
7. Plan rejected
8. Plan edited
9. File edit approval
10. Shell command approval
11. Package installation approval
12. Running tests
13. Successful tests
14. Failed tests
15. Multi-file changes
16. Large diff
17. Cancel during streaming
18. Cancel during tool execution
19. Runtime unavailable
20. Runtime crash
21. Provider unavailable
22. Authentication required
23. Rate limited
24. Context limit reached
25. Permission denied
26. Timeout
27. Invalid runtime event
28. Interrupted restored session
29. Multi-agent Ruflo-style demonstration
30. Successful task summary

Scenario Lab:

- فقط در development/test قابل دسترسی باشد.
- در production UI عمومی نمایش داده نشود.
- انتخاب Scenario deterministic باشد.
- با query parameter یا test fixture قابل فعال‌شدن باشد.
- screenshot testing را آسان کند.
- timer و random behavior کنترل‌پذیر باشند.
- testها flaky نباشند.

Commit پیشنهادی:

`test(mock-runtime): add deterministic product scenario lab`

---

# 19. Slice 14 — Accessibility، Performance و Polish

Accessibility:

- semantic landmarks
- button labels
- form labels
- keyboard navigation
- focus visibility
- focus restoration
- dialog semantics
- listbox/menu semantics
- live regions فقط در موارد لازم
- reduced motion
- contrast مناسب
- عدم اتکا صرف به رنگ
- screen reader text برای statusها
- accessible error messages

Performance:

- از rerender غیرضروری streaming جلوگیری کن.
- listهای بلند را در صورت نیاز virtualize کن.
- syntax highlighting را lazy کن.
- listener leak نداشته باش.
- timer leak نداشته باش.
- animation دائمی در حالت idle نداشته باش.
- dependency سنگین غیرضروری اضافه نکن.
- bundle را قبل و بعد اندازه‌گیری کن.
- افزایش معنی‌دار bundle را مستند و توجیه کن.
- memory leak در تغییر Session و unmount بررسی شود.

Visual polish:

- spacing consistency
- typography hierarchy
- empty states
- error states
- loading states
- skeleton فقط در صورت نیاز
- hover/focus/active/disabled states
- truncation و tooltip
- Windows title bar behavior
- high-DPI appearance
- scrollbar consistency
- no horizontal overflow در viewport هدف

Commit پیشنهادی:

`fix(ui): improve accessibility, performance, and visual consistency`

---

# 20. تست‌های اجباری

حداقل تست‌ها:

## Unit tests

- Zod event validation
- invalid event handling
- runtime subscription cleanup
- cancellation state machine
- session reducer/store
- persistence migration
- corrupt persistence recovery
- approval resolution
- task status transitions
- provider/model selection
- layout persistence

## Component tests

- Composer
- Mode selector
- Provider selector
- Streaming message
- Stop button
- Plan card
- Approval card
- Tool timeline
- Session list
- Diff viewer
- Settings state
- Runtime error banner

## Playwright

- onboarding
- open recent project mock
- create session
- send prompt
- streaming
- cancel streaming
- plan approval
- shell approval rejection
- successful tool run
- failed test run
- diff review
- session persistence
- panel resize
- command palette
- keyboard-only basic path
- provider unavailable
- invalid runtime event recovery
- restored interrupted session
- no console errors

Playwright باید:

- از network یا Provider واقعی استفاده نکند.
- deterministic باشد.
- timeoutهای بی‌دلیل طولانی نداشته باشد.
- از assertionهای شکننده مبتنی بر کل textContent پرهیز کند.
- locatorهای semantic یا test ID پایدار داشته باشد.
- whitespace formatting باعث شکست نشود.
- screenshotهای ثابت تولید کند.

## Build checks

- formatting
- lint
- TypeScript
- unit tests
- Playwright
- frontend production build
- Tauri build/check
- Windows GitHub Actions
- artifact generation

---

# 21. Screenshotهای اجباری CI

حداقل screenshotها:

1. Onboarding
2. Empty workspace
3. Active streaming conversation
4. Plan awaiting approval
5. Tool activity timeline
6. Approval dialog
7. Multi-file diff
8. Running tests
9. Runtime error
10. Settings/providers
11. Session history
12. Multi-agent demonstration

Screenshotها باید:

- در artifact مشخص قرار گیرند.
- نام‌های ثابت و قابل فهم داشته باشند.
- viewport ثابت داشته باشند.
- font loading کنترل شود.
- animationها در screenshot test غیرفعال شوند.
- وضعیت Mock را واضح نشان دهند.
- هیچ Ollama UI نداشته باشند.

---

# 22. مستندات موردنیاز

مستندات را مختصر، کاربردی و بدون تکرار نگه دار.

حداقل:

## README

- وضعیت فعلی محصول
- روش اجرای development
- روش اجرای test
- روش build
- توضیح اینکه runtime فعلی Mock است
- معماری آینده Jcode
- عدم وجود Ollama
- لینک artifactهای CI در صورت امکان

## Frontend Architecture

- component boundaries
- state ownership
- StudioRuntimeBridge
- event model
- persistence
- mock scenarios
- security boundaries

## Roadmap

به‌ترتیب:

1. Complete mock frontend
2. Jcode managed runtime
3. Claude/Codex/Gemini/Copilot integration
4. Ruflo advanced orchestration
5. Soup skill routing
6. OmniRoute provider routing
7. Security hardening
8. Beta release

## Testing

- unit
- component
- Playwright
- screenshot
- Windows artifact
- manual QA checklist

از نوشتن roadmapهای متناقض خودداری کن. هر مستند قدیمی مبتنی بر Ollama را حذف یا به‌روزرسانی کن.

---

# 23. موارد خارج از Scope

در این مأموریت انجام نده:

- یکپارچه‌سازی واقعی Jcode
- دانلود یا اجرای Jcode
- یکپارچه‌سازی Ruflo
- نصب Ruflo در محصول
- یکپارچه‌سازی Soup
- یکپارچه‌سازی OmniRoute
- اتصال Claude
- اتصال Codex/OpenAI
- اتصال Gemini
- اتصال GitHub Copilot
- ذخیره API Key
- billing
- telemetry خارجی
- cloud sync
- auto-update production
- انتشار Release
- Merge PR
- ساخت backend غیرضروری
- افزودن WebGL یا animation سنگین
- افزودن Monaco بدون نیاز اثبات‌شده
- افزودن قابلیت‌های unrelated

اگر برای نمایش UX به این قابلیت‌ها نیاز بود، فقط Mock typed و صادقانه ایجاد کن.

---

# 24. تعریف دقیق Done

Frontend فقط زمانی Done محسوب می‌شود که تمام موارد زیر برقرار باشند:

- Ollama از UI و runtime حذف شده باشد.
- هیچ Tauri command مربوط به Ollama باقی نمانده باشد.
- هیچ درخواست به `127.0.0.1:11434` وجود نداشته باشد.
- StudioRuntimeBridge typed وجود داشته باشد.
- Mock runtime deterministic وجود داشته باشد.
- تمام eventهای ورودی Zod validation داشته باشند.
- Shell کامل و resizable باشد.
- Onboarding کامل باشد.
- Chat و Composer کامل باشند.
- Ask/Plan/Agent mode وجود داشته باشد.
- Streaming و cancellation کار کنند.
- Plan approval UX کامل باشد.
- Tool timeline کامل باشد.
- Approval Center کامل باشد.
- Explorer و Search کامل باشند.
- Diff Viewer قابل استفاده باشد.
- Tasks/Agents/Changes/Context panel وجود داشته باشد.
- Terminal/Problems/Output/Agent Logs panel وجود داشته باشد.
- Session management و persistence کار کنند.
- Settings provider-neutral باشد.
- Command Palette و keyboard navigation کار کنند.
- Mock Scenario Lab وجود داشته باشد.
- error/loading/empty/disabled states پوشش داده شده باشند.
- viewport `1366×768` بدون شکست باشد.
- accessibility review انجام شده باشد.
- console error وجود نداشته باشد.
- unhandled promise rejection وجود نداشته باشد.
- lint سبز باشد.
- typecheck سبز باشد.
- unit tests سبز باشند.
- Playwright سبز باشد.
- production build سبز باشد.
- Windows CI سبز باشد.
- Windows artifact ساخته شده باشد.
- screenshot artifact ساخته شده باشد.
- Playwright report artifact ساخته شده باشد.
- PR description و checklist به‌روز شده باشند.
- PR همچنان Draft باشد.
- PR Merge نشده باشد.

---

# 25. مدیریت خطا و تصمیم‌گیری مستقل

اگر در پیاده‌سازی ابهام جزئی وجود داشت:

1. از conventions فعلی Repository پیروی کن.
2. ساده‌ترین راه production-quality را انتخاب کن.
3. تصمیم را در commit یا architecture note مستند کن.
4. از من سؤال نپرس.
5. کار را ادامه بده.

اگر dependency جدید لازم شد:

1. maintenance و license آن را بررسی کن.
2. ترجیحاً از dependencyهای فعلی استفاده کن.
3. package کوچک و فعال انتخاب کن.
4. dependency را pin یا lockfile را به‌روز کن.
5. دلیل استفاده را مستند کن.
6. vulnerabilityهای مهم را بررسی کن.

اگر تست flaky شد:

1. root cause را پیدا کن.
2. randomness و timer را deterministic کن.
3. assertion را semantic کن.
4. تست را skip نکن.
5. timeout را بدون دلیل بالا نبر.

اگر UI فعلی با طرح جدید تضاد داشت:

1. componentهای سالم را حفظ کن.
2. state و naming را provider-neutral کن.
3. Ollama assumption را حذف کن.
4. از rewrite کامل مگر در صورت ضرورت خودداری کن.

اگر CI Windows رفتاری متفاوت داشت:

1. path handling را cross-platform کن.
2. shell assumptionهای Unix-only را حذف کن.
3. line ending و path separator را کنترل کن.
4. مشکل را با test پوشش بده.

---

# 26. Stop Conditions

فقط در این شرایط مأموریت را متوقف و گزارش کامل ارائه کن:

1. branch فعلی با branch مجاز نشست سازگار نیست و طبق قوانین Arena اجازه تغییر نداری.
2. GitHub authentication قطع شده است.
3. تغییر نیازمند API Key، خرید یا credential کاربر است.
4. امنیت Repository یا اطلاعات حساس در خطر است.
5. GitHub یا CI برای مدت طولانی اختلال خارجی دارد.
6. محدودیت محیط مانع قطعی build است و CI نیز امکان بررسی ندارد.
7. conflictی وجود دارد که حل خودکار آن احتمال از دست‌رفتن تغییرات کاربر را دارد.
8. بعد از پنج چرخه مستقل، یک failure مشخص همچنان حل نشده است.

گزارش توقف باید شامل این موارد باشد:

- مرحله‌ای که متوقف شد
- command یا check شکست‌خورده
- متن دقیق خطا
- علت ریشه‌ای احتمالی
- کارهایی که امتحان شد
- commit آخر
- وضعیت Git
- وضعیت CI
- تنها اقدامی که واقعاً از من لازم است

برای موارد معمول UI، تست، TypeScript، Rust، CI و refactor متوقف نشو.

---

# 27. گزارش پیشرفت بدون نیاز به حضور من

برای اینکه نیاز نباشد پشت سیستم بنشینم:

1. بین Sliceها منتظر تأیید من نمان.
2. پس از هر Slice سبز commit و push کن.
3. PR را با checklist و خلاصه commitها به‌روزرسانی کن.
4. در صورت امکان یک Progress Comment واحد بساز و همان را ویرایش کن تا PR پر از comment نشود.
5. وضعیت هر Slice را مشخص کن:
   - Planned
   - In progress
   - Implemented
   - Locally verified
   - CI verified
6. لینک runهای CI و artifactها را در PR قرار بده.
7. شکست‌های موقت CI را فقط وقتی گزارش کن که در نهایت حل نشده‌اند.
8. گزارش نهایی را پس از سبزشدن کامل ارائه کن.

---

# 28. قالب گزارش نهایی

در پایان، گزارش نهایی دقیقاً شامل این بخش‌ها باشد:

## Outcome

- آیا مأموریت کامل شد؟
- آیا PR همچنان Draft است؟
- آیا PR Merge نشده است؟
- commit نهایی چیست؟

## Architecture changes

- چه چیزهایی از Ollama حذف شد؟
- StudioRuntimeBridge چگونه طراحی شد؟
- Mock Runtime چگونه کار می‌کند؟
- اتصال آینده Jcode از چه مرزی انجام خواهد شد؟

## Frontend delivered

فهرست تمام صفحه‌ها، پنل‌ها و interactionهای تکمیل‌شده.

## Tests

- lint
- typecheck
- unit
- component
- Playwright
- Tauri
- Windows CI

برای هر مورد نتیجه و تعداد تست‌ها را ارائه کن.

## Artifacts

- Windows artifact
- screenshots
- Playwright report
- لینک GitHub Actions run

## Performance

- bundle summary
- dependency changes
- نکات مربوط به streaming و rendering

## Accessibility

خلاصه بررسی keyboard، focus، semantics، contrast و reduced motion.

## Known limitations

فقط محدودیت‌های واقعی باقی‌مانده را بنویس.

## Next milestone

مرحله بعد فقط باید این باشد:

Jcode Managed Runtime Integration

با مسیر:

React → Tauri IPC → Rust Supervisor → Jcode

اما آن مرحله را در این مأموریت شروع نکن.

---

# 29. دستور شروع

اکنون بدون درخواست تأیید بیشتر:

1. branch و Git status را بررسی کن.
2. PR #1 و آخرین CI را بررسی کن.
3. baseline audit انجام بده.
4. Finn Loop را برای Slice 1 آغاز کن.
5. Ollama را حذف کن.
6. StudioRuntimeBridge و Mock Runtime را بساز.
7. تمام Sliceهای Frontend را به‌ترتیب اجرا کن.
8. پس از هر Slice تست، review، fix، commit و push انجام بده.
9. CI را تا سبزشدن کامل دنبال و اصلاح کن.
10. PR را Draft نگه دار.
11. Merge نکن.
12. وقتی تمام Definition of Done برقرار شد، گزارش نهایی ارائه کن.

هدف کیفیت:

این Frontend نباید یک prototype یا mockup نمایشی باشد. باید یک frontend واقعی، دقیق، تست‌شده، قابل نگهداری، resource-efficient و آماده اتصال به Jcode باشد که بتواند پایه یک محصول Windows حرفه‌ای در سطح جهانی قرار گیرد.
