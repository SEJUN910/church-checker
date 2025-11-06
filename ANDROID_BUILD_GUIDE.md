# 안드로이드 앱 빌드 가이드 (웹뷰 방식)

이 가이드는 Church Checker 웹앱을 Capacitor를 사용하여 안드로이드 앱으로 변환하고 구글 플레이 스토어에 배포하는 방법을 설명합니다.

## 사전 준비물

1. **Android Studio** 설치
   - https://developer.android.com/studio 에서 다운로드
   - 설치 시 Android SDK, Android SDK Platform, Android Virtual Device 모두 선택

2. **Java JDK** 설치 (Android Studio에 포함되어 있음)

3. **Node.js** (이미 설치되어 있음)

## 1단계: Capacitor 설치 및 초기화

### 1-1. Capacitor 패키지 설치
```bash
npm install @capacitor/core @capacitor/cli
```

### 1-2. Android 플랫폼 추가
```bash
npm install @capacitor/android
```

### 1-3. Capacitor 초기화
```bash
npx cap init
```

입력 정보:
- **App name**: `Church Checker`
- **App Package ID**: `com.yourname.churchchecker` (본인의 도메인이나 이름으로 변경)
- **Web asset directory**: `www` (임시, 실제로는 localhost 서버 사용)

## 2단계: Capacitor 설정 파일 생성

프로젝트 루트에 `capacitor.config.ts` 파일이 생성됩니다. 다음과 같이 수정하세요:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.churchchecker', // 위에서 설정한 ID
  appName: 'Church Checker',
  webDir: 'www', // 임시 폴더
  server: {
    // 개발 시: localhost 서버 사용
    url: 'http://localhost:3000',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2563eb",
      showSpinner: false,
    },
  },
};

export default config;
```

**중요**: 프로덕션 배포 시에는 `server.url`을 실제 배포된 웹사이트 URL로 변경해야 합니다.

예: `url: 'https://your-website.com'`

## 3단계: 개발 및 테스트

### 3-1. www 폴더 생성 (한 번만)
```bash
mkdir www
echo "<html><body>Loading...</body></html>" > www/index.html
```

### 3-2. Android 플랫폼 추가
```bash
npx cap add android
```

### 3-3. 동기화
```bash
npx cap sync
```

### 3-4. Next.js 개발 서버 실행
**새 터미널 창을 열어서:**
```bash
npm run dev
```

### 3-5. Android 앱 테스트
**다른 터미널 창에서:**
```bash
npx cap run android
```

앱이 실행되면 `http://localhost:3000`의 내용이 표시됩니다.

⚠️ **주의**: 개발 시에는 컴퓨터와 안드로이드 기기가 같은 Wi-Fi에 연결되어 있어야 합니다.

## 4단계: Android 앱 아이콘 및 스플래시 스크린 설정

### 4-1. 아이콘 준비
다음 크기의 PNG 아이콘을 준비하세요:
- `icon-foreground.png` (1024x1024)
- `icon-background.png` (1024x1024)

### 4-2. 아이콘 생성 도구 사용
```bash
# cordova-res 설치 (아이콘/스플래시 자동 생성)
npm install -g cordova-res

# resources 폴더 생성
mkdir resources

# 아이콘 파일을 resources 폴더에 복사
# icon.png (1024x1024)
# splash.png (2732x2732)

# 자동 생성
npx cordova-res android --skip-config --copy
```

또는 수동으로:
- `android/app/src/main/res/` 폴더에 각 해상도별 아이콘 배치
  - `mipmap-mdpi/` (48x48)
  - `mipmap-hdpi/` (72x72)
  - `mipmap-xhdpi/` (96x96)
  - `mipmap-xxhdpi/` (144x144)
  - `mipmap-xxxhdpi/` (192x192)

## 5단계: Android 권한 설정

`android/app/src/main/AndroidManifest.xml` 파일 수정:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 필요한 권한 추가 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <!-- Activity 설정은 그대로 유지 -->
    </application>
</manifest>
```

## 6단계: Android Studio에서 빌드

### 6-1. Android Studio 열기
```bash
npx cap open android
```

### 6-2. Gradle 동기화
- Android Studio가 열리면 자동으로 Gradle 동기화가 시작됩니다
- 완료될 때까지 기다리세요

### 6-3. 테스트 (선택사항)
- 상단 메뉴에서 에뮬레이터 또는 실제 기기 선택
- 재생 버튼(▶️) 클릭하여 앱 실행 테스트

## 7단계: 프로덕션 배포 준비

### 7-0. 웹사이트 배포 (필수)

먼저 Next.js 앱을 실제 서버에 배포해야 합니다.

**Vercel 배포 (추천):**
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel
```

배포 후 URL을 받습니다 (예: `https://church-checker.vercel.app`)

### 7-0-1. capacitor.config.ts 수정

배포된 URL로 변경:
```typescript
const config: CapacitorConfig = {
  appId: 'com.yourname.churchchecker',
  appName: 'Church Checker',
  webDir: 'www',
  server: {
    url: 'https://church-checker.vercel.app', // 실제 배포 URL
    androidScheme: 'https'
  },
  // ...
};
```

그 후 동기화:
```bash
npx cap sync
```

## 8단계: Release APK/AAB 빌드

### 8-1. Keystore 생성 (처음 한 번만)
```bash
# Windows
keytool -genkey -v -keystore church-checker.keystore -alias church-checker -keyalg RSA -keysize 2048 -validity 10000

# 정보 입력
# 비밀번호 설정 및 기억하기!
```

### 9-2. Keystore를 android 폴더로 이동
```bash
# church-checker.keystore 파일을 android/app/ 폴더로 이동
```

### 9-3. key.properties 파일 생성

`android/key.properties` 파일 생성:
```properties
storePassword=여기에_비밀번호
keyPassword=여기에_비밀번호
keyAlias=church-checker
storeFile=church-checker.keystore
```

⚠️ **중요**: `key.properties`는 절대 Git에 커밋하지 마세요! `.gitignore`에 추가하세요.

### 9-4. build.gradle 수정

`android/app/build.gradle` 파일 수정:

```gradle
// 파일 최상단에 추가
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...

    // signingConfigs 섹션 추가 (buildTypes 위에)
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release  // 이 줄 추가
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 9-5. AAB (Android App Bundle) 빌드

Android Studio에서:
1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** 선택
3. Keystore 경로 및 비밀번호 입력
4. **release** 빌드 타입 선택
5. **Finish**

생성된 파일 위치: `android/app/release/app-release.aab`

또는 명령어로:
```bash
cd android
./gradlew bundleRelease
```

## 9단계: Google Play Console에 업로드

### 9-1. Google Play Console 계정 생성
- https://play.google.com/console
- 개발자 등록 ($25 일회성 비용)

### 9-2. 새 앱 만들기
1. **만들기** → **앱 만들기**
2. 앱 이름: `Church Checker`
3. 기본 언어: 한국어
4. 앱 유형: 앱 및 게임
5. 무료/유료: 무료

### 9-3. 스토어 등록정보 작성
- **앱 아이콘**: 512x512 PNG
- **스크린샷**: 최소 2개 (각 화면별)
  - 전화: 1080x1920 ~ 1080x2340
- **간단한 설명**: 80자 이내
- **전체 설명**: 4000자 이내
- **앱 카테고리**: 생산성 또는 라이프스타일

### 9-4. AAB 업로드
1. **프로덕션** → **새 출시 만들기**
2. `app-release.aab` 파일 업로드
3. 출시 이름 및 출시 노트 작성

### 9-5. 콘텐츠 등급 설정
- 설문지 작성 (교회 앱이므로 전체 이용가 가능)

### 9-6. 개인정보처리방침 URL 입력
- 개인정보처리방침 페이지 URL 필요

### 9-7. 검토 및 출시
- 모든 항목 완료 후 **검토 → 프로덕션으로 출시**
- Google 검토 (보통 1-3일 소요)

## 10단계: 앱 업데이트 방법

### 10-1. 버전 업데이트
`android/app/build.gradle` 파일에서:
```gradle
android {
    defaultConfig {
        versionCode 2  // 1씩 증가
        versionName "1.1"  // 사용자에게 표시되는 버전
    }
}
```

### 10-2. 새 빌드 및 업로드
```bash
# 1. 웹사이트 배포 (Vercel 등)
vercel --prod

# 2. Capacitor 동기화 (필요시)
npx cap sync

# 3. AAB 빌드
cd android
./gradlew bundleRelease

# 4. Google Play Console에서 새 출시 만들기
```

⚠️ **중요**: 웹뷰 방식이므로 웹사이트를 먼저 배포하면 앱도 자동으로 업데이트됩니다. AAB는 앱 구조나 네이티브 기능이 변경될 때만 다시 빌드하면 됩니다.

## 자주 발생하는 문제 해결

### Q1: "BUILD FAILED" 에러
```bash
# Gradle 캐시 정리
cd android
./gradlew clean
./gradlew bundleRelease
```

### Q2: 앱이 흰 화면만 보임
- `capacitor.config.ts`의 `webDir`이 `out`으로 설정되어 있는지 확인
- `npm run build` 후 `out` 폴더가 생성되었는지 확인
- `npx cap sync` 실행

### Q3: 이미지가 로드되지 않음
- `next.config.ts`에서 `images.unoptimized: true` 설정 확인
- Supabase Storage URL이 올바른지 확인

### Q4: 카메라가 작동하지 않음
- `AndroidManifest.xml`에 `CAMERA` 권한 추가 확인
- Capacitor Camera 플러그인 설치: `npm install @capacitor/camera`

## 유용한 명령어 모음

```bash
# Capacitor 동기화 (코드 변경 후 항상 실행)
npx cap sync

# Android Studio 열기
npx cap open android

# 빌드 & 동기화 (한 번에)
npm run build && npx cap sync

# 디버그 로그 보기
npx cap run android -l

# 연결된 기기 확인
adb devices
```

## 추가 최적화

### PWA + 네이티브 앱 동시 지원
- 웹에서도 동일한 경험 제공
- `public/manifest.json` 설정 유지
- Service Worker로 오프라인 지원

### 푸시 알림 (선택사항)
```bash
npm install @capacitor/push-notifications
```

Firebase Cloud Messaging 설정 필요

### 앱 성능 최적화
- Next.js 이미지 최적화 활용
- Lazy loading 적용
- 번들 크기 최소화

---

## 문의 및 지원

문제가 발생하면:
1. Android Studio의 Logcat 확인
2. Chrome DevTools에서 웹뷰 디버깅: `chrome://inspect`
3. Capacitor 공식 문서: https://capacitorjs.com

화이팅! 🎉
