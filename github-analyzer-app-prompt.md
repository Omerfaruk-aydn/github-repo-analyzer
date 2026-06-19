# GitHub Repository Analyzer — Full-Stack Uygulama Geliştirme Promptu

> **Kullanım notu:** Bu dosyanın tamamını olduğu gibi kopyalayıp Claude Code, Cursor, Windsurf, Devin veya benzeri bir AI kodlama ajanına "system prompt" veya ilk görev tanımı olarak verebilirsin. Doküman, bir AI ajanına hitaben (2. tekil şahıs, görev/talimat formatında) yazılmıştır; insan geliştiriciler için de teknik şartname olarak kullanılabilir.

---

## 0. ROL VE GÖREV

Sen, LLM destekli geliştirici araçları konusunda uzmanlaşmış, kıdemli (staff/principal seviye) bir full-stack yazılım mimarisin. Görevin, **"RepoMind"** (veya kullanıcının seçeceği bir isimle) adlı, herkese açık veya özel GitHub repolarını analiz eden, mimariyi anlayan, README üreten, potansiyel bug/hata tespit eden ve geliştirme önerileri sunan, **çoklu LLM sağlayıcı destekli** bir SaaS uygulamasını production-ready kalitede inşa etmek.

Uygulamanın kalbi (**"beyin"**) bir **LLM Orchestration katmanıdır**: kullanıcı kendi API anahtarını girerek OpenAI, Anthropic, Google, Mistral, xAI, Meta (Llama), Cohere, DeepSeek, Alibaba (Qwen), Amazon Bedrock, Azure OpenAI, OpenRouter, Groq, Together AI, Fireworks AI, Perplexity veya yerel modeller (Ollama/LM Studio) gibi **herhangi bir sağlayıcıyı ve o sağlayıcının herhangi bir modelini** seçip kullanabilmelidir. Sistem sağlayıcı/model bağımsız (vendor-agnostic) tasarlanmalı; yeni bir sağlayıcı eklemek kod tabanının çekirdeğine dokunmadan, tek bir adaptör dosyasıyla mümkün olmalıdır.

AI-slop (yüzeysel, jenerik, "harika ve kapsamlı" gibi boş sıfatlarla dolu, gerçekte çalışmayan) bir çıktı **kabul edilemez**. Her modül; veri modeli, API sözleşmesi, hata senaryoları ve kabul kriterleriyle birlikte somut şekilde tanımlanmalıdır.

---

## 1. ÜRÜN VİZYONU

**Problem:** Bir geliştirici yeni bir repoya (kendi şirketinin eski projesi, açık kaynak bir kütüphane, mülakat öncesi inceleme, due-diligence) girdiğinde mimariyi, kod kalitesini ve riskleri anlamak saatler/günler alır. README'ler genelde eski veya eksiktir.

**Çözüm:** Kullanıcı bir GitHub linki girer → sistem repoyu çeker → kod tabanını parse eder → seçilen LLM(ler) ile katman katman analiz eder → 5-10 dakika içinde şunları üretir:

1. **Mimari özeti** (katmanlar, kullanılan pattern'ler, modüller arası bağımlılık grafiği, mermaid diyagramı)
2. **Otomatik üretilmiş / güncellenmiş README.md** (kurulum, kullanım, mimari, katkı rehberi dahil)
3. **Bug & hata raporu** (dosya/satır referanslı, önem derecesi etiketli, önerilen düzeltmeyle birlikte)
4. **Güvenlik bulguları** (sızdırılmış secret'lar, zafiyetli bağımlılıklar, yaygın güvenlik anti-pattern'leri)
5. **Geliştirme/özellik önerileri** (önceliklendirilmiş roadmap önerisi)
6. **Repo ile sohbet** (RAG tabanlı soru-cevap: "auth nasıl çalışıyor?", "bu fonksiyonu nereden çağırıyorlar?")

---

## 2. TEMEL KULLANICI SENARYOLARI

| # | Senaryo | Akış |
|---|---|---|
| 1 | **Hızlı misafir analizi** | Kayıt olmadan public bir repo linki girilir, sistem kendi default/ücretsiz model havuzunu kullanır (rate-limitli), özet rapor üretir. |
| 2 | **Kayıtlı kullanıcı — derin analiz** | Kullanıcı kendi LLM API key'lerini ekler, hangi modeli/modelleri hangi görev için kullanacağını seçer, tüm modülleri (bug, security, readme, suggestions, chat) çalıştırır. |
| 3 | **Private repo analizi** | Kullanıcı GitHub OAuth ile bağlanır, scope'lu erişim verir (sadece okuma), private repo seçilip analiz edilir. |
| 4 | **CI/CD tetiklemeli analiz** | Her PR'da webhook ile tetiklenir, sadece değişen dosyalar diff bazlı analiz edilir, sonuç PR yorumu olarak döner. |
| 5 | **Takım/organizasyon kullanımı** | Birden fazla kullanıcı aynı org altında raporları paylaşır, ortak bütçe/limit yönetir. |
| 6 | **Yeniden analiz / karşılaştırma** | Aynı repo zaman içinde tekrar analiz edilip önceki rapor ile diff/karşılaştırma gösterilir (teknik borç trendi). |

---

## 3. SİSTEM MİMARİSİ (ÜST SEVİYE)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js, App Router, React Server Components)             │
│  - Landing / Auth / Dashboard / Analysis Viewer / Chat / Settings    │
└───────────────┬──────────────────────────────────────────────────────┘
                │ REST/GraphQL + WebSocket (SSE fallback)
┌───────────────▼──────────────────────────────────────────────────────┐
│  API GATEWAY / BACKEND (Node.js/NestJS veya Python/FastAPI)          │
│  - Auth, Rate limiting, Request validation, Billing/Usage             │
└───┬────────────┬───────────────┬───────────────┬─────────────────────┘
    │             │               │               │
┌───▼───┐   ┌─────▼─────┐   ┌─────▼──────┐   ┌────▼─────────┐
│Postgres│   │ Redis     │   │ Vector DB  │   │ Object Store │
│(ana DB)│   │(queue/    │   │(pgvector / │   │(S3/R2 — repo │
│        │   │ cache)    │   │ Qdrant)    │   │ snapshot,    │
│        │   │           │   │            │   │ raporlar)    │
└────────┘   └─────┬─────┘   └────────────┘   └──────────────┘
                    │
        ┌───────────▼────────────┐
        │   JOB QUEUE / WORKERS   │  (BullMQ / Celery)
        │  - repo-ingest worker   │
        │  - analysis worker(ler) │
        │  - report worker        │
        └───────────┬────────────┘
                     │
        ┌────────────▼─────────────────────────────────────┐
        │        GITHUB INTEGRATION KATMANI                 │
        │  - REST/GraphQL API, OAuth App / GitHub App,       │
        │    shallow clone, rate-limit handling              │
        └────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────────────┐
        │     LLM ORCHESTRATION KATMANI ("BEYİN")            │
        │  Provider Adapters → Unified Interface → Router    │
        │  → Prompt Templates → Agents → Cache → Cost Track  │
        └─────────────────────────────────────────────────────┘
```

**Mimari prensipler:**
- **Stateless API katmanı**, tüm uzun süren işler (repo klonlama, LLM çağrıları) **async worker**'lara devredilir; kullanıcı WebSocket/SSE üzerinden canlı ilerleme görür.
- **LLM çağrıları asla senkron HTTP request içinde beklenmez** (timeout riski) — her zaman job kuyruğu üzerinden yürütülür.
- Tüm bileşenler container'lanır (Docker), yatayda ölçeklenebilir (worker sayısı analiz hacmine göre auto-scale).

---

## 4. TEKNOLOJİ STACK ÖNERİSİ (gerekçeli)

| Katman | Seçim | Gerekçe |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui** | SSR/streaming ile uzun analiz sürecinde iyi UX, geniş ekosistem |
| Backend API | **NestJS (TypeScript)** *veya* **FastAPI (Python)** | NestJS: tip güvenliği + frontend ile aynı dil. FastAPI: Python'un AST/static-analysis kütüphane zenginliği. Öneri: **API katmanı NestJS, analiz-ağır worker'lar Python** (polyglot, her ikisi de Redis kuyruğu üzerinden konuşur). |
| Queue | **BullMQ (Redis tabanlı)** | Node tarafı için olgun, retry/backoff/progress event desteği native |
| Worker (Python) | **Celery + Redis broker** veya doğrudan Redis Streams tüketen custom worker | AST parsing (tree-sitter), embedding üretimi Python'da daha zengin |
| Ana DB | **PostgreSQL 16** | İlişkisel veri (kullanıcı, repo, analiz, bulgu) için endüstri standardı |
| Vector DB | **pgvector (Postgres eklentisi)** başlangıçta; ölçek büyürse **Qdrant/Weaviate** | Ekstra altyapı eklemeden RAG'a başlamak için pgvector yeterli |
| Cache | **Redis** | LLM yanıt cache'i, oturum, rate-limit sayaçları |
| Object Storage | **S3 uyumlu (AWS S3 / Cloudflare R2)** | Repo snapshot, üretilen PDF/Markdown raporlar |
| Auth | **GitHub OAuth + NextAuth/Auth.js**, opsiyonel email/magic-link | GitHub entegrasyonu zaten zorunlu, OAuth doğal seçim |
| Static/Security analiz | **Tree-sitter** (çoklu dil AST), **Semgrep** (SAST), **OSV API** (bağımlılık zafiyeti), **gitleaks/trufflehog mantığı** (secret tarama) | LLM'i "ham kod okuyup bug bulmaya" zorlamak yerine, deterministik araçların bulgularını LLM'e **yorumlatmak/zenginleştirmek** çok daha güvenilir ve ucuzdur |
| Observability (LLM) | **Langfuse veya kendi tracing tablon** | Her prompt/response/maliyet/latency loglanmalı |
| Deployment | **Docker + docker-compose (dev)**, **Kubernetes veya Render/Fly.io (prod)** | Worker'ların bağımsız ölçeklenmesi gerekir |
| CI/CD | **GitHub Actions** | Repoyu zaten GitHub'da analiz ediyoruz, ekosistem tutarlılığı |

---

## 5. LLM ORCHESTRATION KATMANI — "BEYİN" (EN KRİTİK BÖLÜM)

Bu katman tüm uygulamanın temelidir. Aşağıdaki alt bileşenlerin **hepsi zorunludur**, yüzeysel bir "if provider == openai" yapısı kabul edilmez.

### 5.1 Unified Provider Interface

Her sağlayıcı için ortak bir TypeScript/Python arayüzü tanımla:

```typescript
interface LLMProviderAdapter {
  id: string;                     // "openai" | "anthropic" | "google" | "openrouter" | ...
  listModels(): Promise<ModelInfo[]>;
  complete(req: UnifiedRequest): Promise<UnifiedResponse>;
  stream(req: UnifiedRequest): AsyncGenerator<UnifiedChunk>;
  countTokens(text: string, model: string): number;
  estimateCost(usage: TokenUsage, model: string): CostEstimate;
  supportsCapability(cap: "vision" | "function_calling" | "json_mode" | "long_context"): boolean;
}

interface UnifiedRequest {
  model: string;
  messages: UnifiedMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  stream?: boolean;
}

interface ModelInfo {
  id: string;
  provider: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
}
```

**Desteklenmesi gereken adaptörler (minimum kapsam):**

- **OpenAI** (Chat Completions / Responses API uyumlu)
- **Anthropic** (Messages API)
- **Google** (Gemini — AI Studio ve Vertex AI varyantları)
- **Mistral AI** (kendi API'si)
- **xAI** (Grok)
- **Cohere**
- **DeepSeek**
- **Amazon Bedrock** (çoklu model ev sahibi — Claude, Llama, Titan vb. tek adaptör altında)
- **Azure OpenAI Service**
- **OpenRouter** — kritik: tek bir adaptörle **yüzlerce modele** (çoğu marka) erişim sağlar; kullanıcı tek bir OpenRouter key'i girerek pratikte "her şeyi" kullanabilir. Bu yüzden OpenRouter adaptörü **birinci öncelikli** olarak implemente edilmeli.
- **Groq, Together AI, Fireworks AI** — yüksek hız/düşük maliyetli açık model hosting'leri
- **Ollama / LM Studio** — yerel/self-hosted modeller (localhost endpoint, API key gerektirmez)

> **Mimari kural:** Yeni bir sağlayıcı eklemek şu adımlardan ibaret olmalı: (1) `ProviderAdapter` interface'ini implemente eden yeni bir dosya yaz, (2) provider registry'ye kaydet, (3) DB'ye model meta verilerini ekle (seed veya admin panelden). **Çekirdek iş mantığına (agent'lar, router, cache) hiçbir değişiklik gerekmemeli.**

### 5.2 Model Registry (veritabanı tabanlı, statik kod değil)

Modeller koda hardcode edilmez; `llm_models` tablosunda tutulur ve admin panelinden (veya bir seed script + periyodik sync job ile OpenRouter'ın `/models` endpoint'inden) güncellenir. Böylece yeni bir model çıktığında kod deploy etmeden sisteme eklenebilir.

### 5.3 Key Management (BYOK — Bring Your Own Key)

- Kullanıcı, Settings → "AI Providers" ekranından her sağlayıcı için kendi API key'ini girer.
- Key'ler **uygulama tarafında düz metin tutulmaz**: AES-256-GCM ile, anahtar bir KMS (AWS KMS / Hashicorp Vault) üzerinden yönetilerek şifrelenir; DB'de sadece şifreli blob + key ID saklanır.
- Sistem ayrıca **opsiyonel "managed key" havuzu** sunabilir (misafir/free-tier kullanıcılar için, sıkı rate-limit ve düşük maliyetli modellerle sınırlı).
- Key doğrulama: kullanıcı key eklediğinde arka planda ucuz bir "ping" isteği (örn. model listesi çekme) ile geçerlilik kontrol edilir.

### 5.4 Routing & Fallback Stratejisi

- Kullanıcı her analiz görevi için **manuel model seçebilir** veya **"Auto" modunu** seçebilir.
- "Auto" modda router, görev tipine göre (bkz. Bölüm 7) bir model sınıfı seçer: örn. mimari özetleme gibi uzun bağlam gerektiren görevler → büyük context window'lu modeller; satır bazlı bug tespiti gibi yapısal/JSON çıktı gerektiren görevler → güçlü function-calling/JSON-mode desteği olan modeller; ucuz/yüksek hacimli ön-filtreleme görevleri → ucuz/hızlı modeller.
- **Fallback zinciri:** Birincil model rate-limit/hata verirse, tanımlı bir fallback listesi (örn. aynı modelin OpenRouter üzerinden alternatif sağlayıcısı) otomatik denenir. 3 başarısız denemeden sonra job "kısmi başarısız" olarak işaretlenir ve kullanıcıya bildirilir — **asla sessizce sahte/boş veri döndürülmez.**

### 5.5 Maliyet ve Token Yönetimi

- Her çağrı öncesi `countTokens` ile tahmini maliyet hesaplanır.
- Kullanıcıya analiz başlamadan **tahmini maliyet aralığı** gösterilir (örn. "Bu analiz yaklaşık $0.40–$1.20 arası tutacak, devam edilsin mi?").
- Her gerçek çağrı sonrası gerçek `usage` (prompt_tokens, completion_tokens) `usage_logs` tablosuna yazılır.
- Kullanıcı/organizasyon bazlı **aylık bütçe limiti** tanımlanabilir; limit aşılırsa yeni job'lar kuyruğa alınmaz, kullanıcı bilgilendirilir.

### 5.6 Prompt Template & Agent Yönetimi

- Her analiz görevi (mimari, bug, readme, vb.) için **versiyonlanmış prompt template'leri** ayrı dosyalarda/DB'de tutulur (örn. `prompts/architecture_analysis/v3.md`).
- Template'ler **few-shot örnekler**, **çıktı şeması (JSON Schema)** ve **görev talimatını** içerir; LLM çıktısı her zaman şemaya karşı validate edilir (örn. Zod/Pydantic). Şema dışı çıktı → otomatik 1 kez "repair" isteği ("çıktın şu şemaya uymuyor, düzelt") → yine başarısızsa hata olarak loglanır.
- Karmaşık görevler (örn. "repo'yu analiz et ve hangi dosyaları okuman gerektiğine kendin karar ver") için **tool-use/function-calling tabanlı agentic akış** kurulmalı: LLM'e `read_file(path)`, `search_code(query)`, `list_directory(path)`, `get_dependency_graph()` gibi tool'lar verilir; LLM kendi karar verir hangi dosyaları okuyacağına (tüm repoyu context'e tıkıştırmak yerine).

### 5.7 Cache

- Aynı `(repo_commit_sha, file_hash, prompt_template_version, model_id)` kombinasyonu için LLM yanıtı Redis/Postgres'te cache'lenir. Aynı commit üzerinde tekrar analiz istenirse (örn. farklı kullanıcı aynı public repoyu analiz ederse) gereksiz tekrar çağrı yapılmaz — hem maliyet hem hız kazancı.

---

## 6. REPO INGESTION & CODE UNDERSTANDING PIPELINE

1. **Girdi doğrulama:** GitHub URL parse edilir (`owner/repo`, branch/tag opsiyonel). Repo public mı private mı tespit edilir.
2. **Erişim:** Public repo → GitHub REST API + shallow `git clone --depth=1`. Private repo → kullanıcının OAuth/GitHub App token'ı ile, **sadece `contents:read` scope'u** kullanılarak.
3. **Filtreleme:** `.gitignore` saygı gösterilir; binary dosyalar, `node_modules`, `dist`, `build`, lock dosyaları, görseller analiz dışı bırakılır. Dosya boyutu limiti (örn. >1MB tek dosya → özetlenerek dahil edilir, ham içerik LLM'e gönderilmez).
4. **Dil/Framework tespiti:** Dosya uzantıları + paket manifest dosyaları (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml` vb.) üzerinden teknoloji stack çıkarımı.
5. **AST Parsing:** **Tree-sitter** ile desteklenen diller için (JS/TS, Python, Go, Java, Rust, C/C++, Ruby, PHP, vb.) fonksiyon/sınıf/import düzeyinde yapısal çıkarım. Bu, LLM'e "ham metin" yerine **yapılandırılmış kod haritası** sunmayı sağlar.
6. **Bağımlılık grafiği:** Import/require ilişkilerinden modüller arası bağımlılık grafiği (DAG) çıkarılır → mimari analiz agent'ının girdisi.
7. **Hiyerarşik özetleme (map-reduce):** Büyük repolarda her dosya önce kısa özetlenir (ucuz/hızlı model) → dosya özetleri modül bazında birleştirilir → modül özetleri proje genel özetine indirgenir. Bu, context window sınırlarını aşan büyük repoları yönetmenin standart yoludur.
8. **Embedding üretimi:** Kod parçaları (fonksiyon/sınıf düzeyinde chunk'lanmış) embedding modeliyle (örn. seçilen sağlayıcının embedding endpoint'i) vektörleştirilip pgvector'a yazılır → **Chat/Q&A modülü** için RAG retrieval kaynağı.

---

## 7. ANALİZ MODÜLLERİ (AGENT'LAR)

Her agent: **Girdi → Süreç → Çıktı şeması → Önerilen model sınıfı** formatında tanımlanmalı.

### 7.1 Mimari Analiz Agent'ı
- **Girdi:** Dosya ağacı, bağımlılık grafiği, modül özetleri.
- **Süreç:** Katmanları (presentation/business/data), kullanılan tasarım kalıplarını (MVC, hexagonal, microservices, event-driven vb.) tespit eder; mermaid `flowchart`/`graph` formatında diyagram üretir.
- **Çıktı:** `{ layers[], patterns[], diagram_mermaid, tech_stack[], entry_points[] }`
- **Model sınıfı:** Uzun context, güçlü akıl yürütme (büyük/flagship model önerilir).

### 7.2 README Generator Agent
- **Girdi:** Proje özeti, kurulum dosyaları (`package.json` scripts, Dockerfile, CI config), mevcut README (varsa, fark analizi için).
- **Süreç:** Standart bölümleri üretir: Açıklama, Özellikler, Kurulum, Kullanım, Mimari diyagram, Ortam değişkenleri, Katkı rehberi, Lisans.
- **Çıktı:** Düzenlenebilir Markdown; kullanıcı bölüm bazında "yeniden üret" diyebilmeli.
- **Model sınıfı:** Orta-büyük, iyi yazım kalitesi olan model.

### 7.3 Bug/Hata Tespit Agent'ı (Hibrit)
- **Süreç:** Önce deterministik araçlar (Semgrep kural seti, dil-spesifik linter'lar — ESLint/Pylint/golangci-lint) çalıştırılır → ham bulgular elde edilir → LLM bu bulguları **doğrular, önceliklendirir, insan diliyle açıklar ve düzeltme önerisi (kod diff'i) üretir**. LLM'in "sıfırdan" tüm kodu okuyup bug bulmaya çalışması yerine bu hibrit yaklaşım yanlış pozitif oranını ciddi düşürür.
- **Çıktı şeması:** `{ file, line_start, line_end, severity: "critical"|"high"|"medium"|"low", category, description, suggested_fix_diff, confidence }`
- **Model sınıfı:** JSON-mode/function-calling güçlü model.

### 7.4 Güvenlik Tarama Agent'ı
- Secret/credential sızıntısı taraması (regex + entropi tabanlı, örn. AWS key pattern'leri, gitleaks mantığı) — **bu adım LLM'e gönderilmeden önce** çalışır ve tespit edilen secret'lar LLM'e gönderilmeden redakte edilir (`***REDACTED***`).
- Bağımlılık zafiyeti taraması: `package-lock.json`/`requirements.txt` vb. dosyalardaki versiyonlar **OSV.dev API**'sine sorgulanır, bilinen CVE'ler listelenir.
- LLM, bulunan zafiyetleri etki/önceliğe göre yorumlar ve upgrade önerisi sunar.

### 7.5 Kod Kalitesi / Teknik Borç Agent'ı
- Karmaşıklık metrikleri (cyclomatic complexity, dosya uzunluğu, tekrar eden kod blokları) deterministik araçlarla hesaplanır; LLM bunları "teknik borç skoru" ve aksiyon önerisine dönüştürür.

### 7.6 Özellik/Geliştirme Önerisi Agent'ı (kullanıcının özellikle istediği "başka neler ekleyebiliriz" kısmı)
- **Girdi:** Mimari özet + mevcut özellik seti (route/endpoint listesi, UI bileşenleri) + (varsa) açık issue'lar/TODO yorumları.
- **Süreç:** Eksik standart özellikleri (test coverage, CI/CD, error handling, logging/monitoring, i18n, erişilebilirlik, rate limiting, API versioning vb.) tespit eder; ayrıca projenin **domain'ine özgü** somut özellik önerileri üretir.
- **Çıktı:** Önceliklendirilmiş liste — `{ title, description, impact: "high"|"medium"|"low", effort_estimate, category }`

### 7.7 Chat / Soru-Cevap Agent'ı (RAG)
- Kullanıcı serbest metinle soru sorar ("auth middleware nerede tanımlı?") → soru embedding'e çevrilir → pgvector'da en alakalı kod chunk'ları retrieve edilir → bu context ile LLM yanıt üretir, **kaynak dosya/satır referanslarıyla**.
- Streaming yanıt (token-by-token) desteklenmeli.

### 7.8 Test Kapsamı Boşluk Analizi
- Mevcut test dosyaları ile kaynak kod eşleştirilir; test edilmeyen kritik fonksiyonlar/dosyalar listelenir, öncelik sırasıyla.

### 7.9 Onboarding Rehberi Üretici
- Yeni bir geliştiricinin projeye nereden başlaması gerektiğini (entry point, kritik dosyalar, lokal kurulum adımları, "ilk PR için iyi başlangıç noktaları") özetleyen ek bir doküman.

---

## 8. VERİTABANI ŞEMASI (taslak)

```sql
users (id, email, github_id, name, avatar_url, plan, created_at)
organizations (id, name, owner_id, plan, monthly_budget_usd)
org_members (org_id, user_id, role)

repositories (id, owner_user_id, org_id, github_url, owner, name,
              default_branch, is_private, last_synced_sha, created_at)

analyses (id, repository_id, requested_by, status, commit_sha,
          started_at, completed_at, total_cost_usd, config_json)

analysis_jobs (id, analysis_id, agent_type, status, model_used,
               started_at, completed_at, error_message, retry_count)

analysis_findings (id, analysis_id, agent_type, file_path,
                    line_start, line_end, severity, category,
                    title, description, suggested_fix, confidence)

generated_readmes (id, analysis_id, content_markdown, version, created_at)

llm_providers (id, slug, display_name, base_url, auth_type)
llm_models (id, provider_id, model_id, display_name, context_window,
            max_output_tokens, input_cost_per_1m, output_cost_per_1m,
            supports_vision, supports_function_calling, is_active)

user_api_keys (id, user_id, provider_id, encrypted_key, key_id_kms,
               last_validated_at, is_valid)

usage_logs (id, analysis_id, user_id, model_id, prompt_tokens,
            completion_tokens, cost_usd, latency_ms, created_at)

chat_sessions (id, repository_id, user_id, created_at)
chat_messages (id, session_id, role, content, cited_files_json, created_at)

code_embeddings (id, repository_id, file_path, chunk_index,
                  content, embedding vector(1536), commit_sha)
```

---

## 9. BACKEND API TASARIMI (örnek REST yüzeyi)

```
POST   /api/repositories                # repo ekle (URL doğrula, meta çek)
POST   /api/repositories/:id/analyze    # yeni analiz başlat { agents[], model_overrides{} }
GET    /api/analyses/:id                # analiz durumu + sonuç
GET    /api/analyses/:id/findings       # filtrelenebilir bulgu listesi (?severity=critical)
GET    /api/analyses/:id/readme         # üretilen README
POST   /api/analyses/:id/readme/regenerate
GET    /api/analyses/:id/cost-estimate  # başlamadan önce tahmini maliyet
WS     /ws/analyses/:id/progress        # canlı ilerleme (job bazlı yüzde + log)

POST   /api/chat/sessions               # repo bazlı sohbet başlat
POST   /api/chat/sessions/:id/messages  # mesaj gönder (stream response)

GET    /api/providers                   # desteklenen sağlayıcı/model listesi
POST   /api/user/api-keys               # key ekle/güncelle
DELETE /api/user/api-keys/:providerId
GET    /api/user/usage                  # maliyet/kullanım geçmişi

POST   /api/webhooks/github              # PR tetikli analiz
```

Tüm endpoint'ler için: **giriş doğrulama (Zod/Pydantic şeması)**, **rate limiting (IP + kullanıcı bazlı)**, **tutarlı hata formatı** (`{ error: { code, message, details } }`) zorunlu.

---

## 10. ASYNC İŞLEM VE GERÇEK ZAMANLI İLERLEME

- Bir "analiz" başlatıldığında, **orkestratör** seçilen agent'lar için ayrı job'lar kuyruğa atar (paralel çalışabilenler paralel: bug-detection ve security-scan birbirine bağımlı değil; README ise mimari analiz çıktısına bağımlı olabilir → **DAG bazlı job bağımlılığı**).
- Her job ilerlemesi (`0–100%`, durum mesajı: "Dosyalar taranıyor…", "Claude ile mimari analiz ediliyor…") Redis pub/sub üzerinden WebSocket'e, oradan frontend'e akar.
- Job retry: geçici hatalarda (rate limit, 5xx) exponential backoff ile 3 deneme; kalıcı hatalarda kullanıcıya görünür hata + "tekrar dene" butonu.

---

## 11. FRONTEND / UX TASARIMI

1. **Landing/Input ekranı:** GitHub URL input + (opsiyonel) branch seçimi + "Quick scan" / "Deep analysis" toggle + tahmini süre/maliyet önizlemesi.
2. **Canlı ilerleme ekranı:** Her agent için ayrı progress satırı (mimari ✅, bug-detection ⏳ %60, security ⏳, readme ⏸ beklemede), canlı log akışı (terminal benzeri, opsiyonel).
3. **Sonuç Dashboard'u (sekmeler):**
   - **Özet:** Skor kartları (mimari netliği, kod kalitesi, güvenlik, test kapsamı), mermaid mimari diyagramı (render edilir, zoom/pan).
   - **Dosya Gezgini:** Repo ağacı, her dosyanın yanında bulgu sayısı rozeti (kritik=kırmızı vb.), dosyaya tıklayınca ilgili satırlar highlight'lı kod görünümü + LLM açıklaması yan panelde.
   - **README:** Üretilen içerik, bölüm bazlı düzenleme, "yeniden üret" butonu, diff görünümü (eski README varsa).
   - **Öneriler:** Kanban benzeri kart listesi (impact/effort matrisi ile sıralanabilir).
   - **Sohbet:** Chat arayüzü, kaynak dosya referansları tıklanabilir (dosya gezginine atlar).
4. **Ayarlar:** Provider/API key yönetimi (her sağlayıcı için kart: bağlı/bağlı değil, "test et" butonu), default model seçimi görev bazında, aylık bütçe limiti slider'ı.
5. **Export:** README.md indir, PDF rapor (tüm bulgular dahil), JSON export (API entegrasyonu için).

Tasarım sistemi: tutarlı renk paleti, koyu/açık tema, monospace font kod blokları için, erişilebilirlik (WCAG AA) gözetilmeli.

---

## 12. GÜVENLİK GEREKSİNİMLERİ

- Kullanıcı API key'leri **asla** loglara, frontend'e (kısmi maskeleme dışında, örn. `sk-...ab12`) veya hata mesajlarına yazılmaz.
- Repo içeriği LLM'e gönderilmeden önce **secret redaction** zorunlu adım (sızan bir AWS key'in OpenAI/Anthropic sunucularına gitmesi kabul edilemez).
- Private repo erişiminde **en az yetki prensibi**: sadece `contents:read`, asla `write`/`admin` scope istenmez.
- Multi-tenant izolasyon: her sorgu `user_id`/`org_id` ile satır bazlı filtrelenir (Postgres RLS — Row Level Security — kullanılması önerilir).
- Tüm dış API çağrıları (GitHub, LLM sağlayıcıları) için timeout + circuit breaker.
- Webhook endpoint'leri GitHub imza doğrulaması (`X-Hub-Signature-256`) ile korunur.

---

## 13. MALİYET VE PERFORMANS YÖNETİMİ

- Büyük repolarda (>5000 dosya) **örnekleme stratejisi**: önce dosya önem skoru hesaplanır (entry point'lere yakınlık, import edilme sıklığı, son commit yoğunluğu) → en önemli N dosya derinlemesine analiz edilir, geri kalanı sadece yapısal özetle dahil edilir.
- Map-reduce özetleme (bkz. 6.7) ile context window aşımı engellenir.
- Cache hit oranı bir metrik olarak izlenmeli (dashboard'da görünür: "Bu analiz cache sayesinde $X tasarruf etti").

---

## 14. GENİŞLETİLEBİLİRLİK

- **Yeni LLM sağlayıcı eklemek:** `ProviderAdapter` implementasyonu + registry kaydı + DB seed. Çekirdek değişmez.
- **Yeni analiz agent'ı eklemek:** `BaseAgent` interface'i (`run(context): Promise<FindingsSchema>`) implemente edilir, agent registry'sine eklenir, frontend'de otomatik olarak agent listesinde görünür (dinamik UI render).
- İleride: kullanıcıların kendi custom prompt'larını/agent'larını ekleyebileceği bir **"plugin marketplace"** vizyonu (V3 roadmap).

---

## 15. TEST STRATEJİSİ

- **Unit testler:** Provider adaptörleri (mock HTTP response'larla), şema validasyonu, maliyet hesaplama fonksiyonları.
- **Integration testler:** Job kuyruğu uçtan uca (bir test repo ile gerçek/mock LLM çağrısı), GitHub API entegrasyonu (VCR/cassette tabanlı kayıt-oynatma).
- **E2E testler:** Playwright ile kritik kullanıcı akışı (URL gir → analiz başlat → sonucu gör).
- **LLM çıktı kalitesi (regresyon):** Sabit bir "golden dataset" (5-10 bilinen açık kaynak repo + beklenen bulgu tipi/sayı aralığı) üzerinde, her prompt template değişikliğinde otomatik değerlendirme çalıştırılır; çıktı kalitesi düşerse CI kırmızı yanar.

---

## 16. DEPLOYMENT / DEVOPS

- `docker-compose.yml` ile lokal geliştirme: postgres, redis, api, worker(lar), frontend tek komutla ayağa kalkmalı.
- Prod: API ve worker'lar **ayrı deployment'lar** olarak ölçeklenir (worker'lar CPU/IO yoğun, bağımsız autoscale gerekir).
- Environment değişkenleri `.env.example` ile dokümante edilir; **hiçbir secret repoya commit edilmez**.
- CI: PR açıldığında lint + test + type-check; main'e merge'de otomatik deploy.
- Monitoring: API için Sentry (hata izleme), LLM çağrıları için ayrı tracing (Langfuse/kendi `usage_logs` tablon + Grafana dashboard).

---

## 17. GELİŞTİRME FAZLARI (ROADMAP)

**MVP (Faz 1):**
- Tek repo analizi, public repo desteği, 2-3 büyük sağlayıcı (OpenAI, Anthropic, OpenRouter — OpenRouter ile pratikte geniş model erişimi sağlanmış olur)
- README üretimi + temel bug tespiti (hibrit linter+LLM)
- Basit dashboard, export (Markdown)

**Faz 2:**
- Tüm sağlayıcı adaptörleri + BYOK key yönetimi
- Security tarama, RAG tabanlı chat
- Private repo (GitHub OAuth)
- Maliyet takibi/bütçe limitleri

**Faz 3:**
- Organizasyon/takım özellikleri, paylaşılan raporlar
- CI/CD (PR bazlı) entegrasyonu
- Test kapsamı analizi, onboarding rehberi üretici
- Plugin/agent marketplace, custom prompt desteği

---

## 18. EK ÖZELLİK FİKİRLERİ ("başka neler ekleyebiliriz")

1. **Diff bazlı yeniden analiz** — sadece son commit'ten beri değişen dosyaları analiz et (hız + maliyet kazancı).
2. **Repo sağlık skoru zaman serisi** — her analizde tek bir "health score" hesaplanıp grafikte trend gösterilir.
3. **Çoklu model konsensüs modu** — kritik bulgular için 2 farklı sağlayıcının modeline aynı soruyu sor, sadece ikisinin de hemfikir olduğu bulguları "yüksek güven" olarak işaretle (yanlış pozitifi azaltır).
4. **IDE eklentisi** — VS Code uzantısı, analiz sonuçlarını editör içinde inline gösterir.
5. **Slack/Discord bildirimleri** — analiz tamamlandığında veya kritik bulgu çıktığında bildirim.
6. **Lisans uyumluluk taraması** — bağımlılıkların lisanslarını (MIT/GPL/AGPL vb.) tarayıp ticari kullanım riski raporu.
7. **Konteynerleştirme önerisi** — Dockerfile yoksa otomatik taslak Dockerfile üretimi.
8. **API maliyeti optimizasyon önerisi** — kullanıcının geçmiş analizlerine bakarak "şu görevler için daha ucuz bir model yeterli olurdu" önerisi.
9. **Repo karşılaştırma** — iki farklı repoyu (örn. iki olası bağımlılık kütüphanesi) yan yana karşılaştırma.
10. **Takım üyesi uzmanlık haritası** — (opsiyonel, git blame entegrasyonuyla) hangi dosyada kim uzman, onboarding'de kime sorulmalı.
11. **Otomatik changelog üretimi** — commit geçmişinden insan-okunur changelog taslağı.
12. **Erişilebilirlik (a11y) taraması** — frontend projelerinde temel a11y kontrolleri.
13. **Public "repo karnesi" paylaşım sayfası** — açık kaynak proje sahiplerinin README'lerine ekleyebileceği bir rozet/link (büyüme kanalı).

---

## 19. KABUL KRİTERLERİ (Definition of Done — MVP için)

- [ ] Kullanıcı public bir GitHub URL'si girip 10 dakika içinde eksiksiz bir rapor (mimari + README + bug listesi) alabiliyor.
- [ ] En az 3 farklı LLM sağlayıcısı (biri OpenRouter olacak şekilde) uçtan uca çalışıyor ve kullanıcı UI'dan seçim yapabiliyor.
- [ ] Hiçbir API key düz metin olarak DB'de veya logda görünmüyor.
- [ ] LLM çıktıları her zaman tanımlı JSON şemasına uyuyor veya açık hata veriyor (sessiz başarısızlık yok).
- [ ] Analiz sırasında canlı ilerleme WebSocket üzerinden gerçek zamanlı görünüyor.
- [ ] Aynı commit için tekrar analiz isteğinde cache devreye giriyor ve bu kullanıcıya gösteriliyor.
- [ ] README ve bulgu raporu Markdown/PDF olarak indirilebiliyor.
- [ ] Repo gizli bilgileri (secret) LLM'e gönderilmeden önce redakte ediliyor — test senaryosuyla doğrulanmış.

---

**Şimdi yukarıdaki şartnameye göre projeyi modül modül inşa et. Her modülü teslim ettikten sonra kabul kriterlerine karşı kendi kendini denetle, eksik veya varsayım içeren noktaları açıkça belirt, asla "tamamlandı" deme eğer test edilmemiş/varsayımsal bir kısım varsa.**
