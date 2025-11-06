# 안드로이드 앱 빠른 시작 가이드

Church Checker를 안드로이드 앱으로 빌드하는 빠른 가이드입니다.

## ✅ 이미 완료된 설정

- ✅ Vercel 배포: `https://church-checker.vercel.app`
- ✅ Capacitor 설정 파일: `capacitor.config.ts`
- ✅ Next.js 설정: 서버 모드로 설정됨
- ✅ www 폴더 및 placeholder 생성

## 📱 1단계: Capacitor 설치

```bash
# Capacitor 패키지 설치
npm install @capacitor/core @capacitor/cli @capacitor/android

# Capacitor 초기화 (이미 설정 파일이 있으므로 건너뛰어도 됨)
# 하지만 package.json에 설정을 추가하려면 실행:
npx cap init "Church Checker" "com.churchchecker.app" --web-dir=www
```

## 📱 2단계: Android 플랫폼 추가

```bash
# Android 플랫폼 추가
npx cap add android

# 동기화 (Vercel URL이 설정된 상태로)
npx cap sync
```

## 🎨 3단계: Android Studio 열기

```bash
# Android Studio 열기
npx cap open android
```

## 🔧 4단계: Android Studio에서 빌드 테스트

1. Android Studio가 열리면 **Gradle 동기화** 대기
2. 상단에서 **에뮬레이터** 또는 **실제 기기** 선택
3. **재생 버튼 (▶️)** 클릭
4. 앱이 실행되고 Vercel 웹사이트가 표시됨

## 📦 5단계: Release APK/AAB 빌드 (스토어 배포용)

### 5-1. Keystore 생성 (처음 한 번만)

```bash
# Keystore 생성
keytool -genkey -v -keystore church-checker.keystore -alias church-checker -keyalg RSA -keysize 2048 -validity 10000

# 정보 입력:
# - 비밀번호 설정 (기억하기!)
# - 이름, 조직 등 입력
```

### 5-2. Keystore 파일 이동

```bash
# church-checker.keystore 파일을 android/app/ 폴더로 이동
move church-checker.keystore android\app\
```

### 5-3. key.properties 파일 생성

`android/key.properties` 파일 생성:

```properties
storePassword=여기에_비밀번호_입력
keyPassword=여기에_비밀번호_입력
keyAlias=church-checker
storeFile=church-checker.keystore
```

⚠️ **중요**: 이 파일은 Git에 커밋되지 않습니다 (.gitignore에 추가됨)

### 5-4. build.gradle 수정

`android/app/build.gradle` 파일 수정:

파일 최상단에 추가:
```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

`android` 블록 안에 `signingConfigs` 추가 (`buildTypes` 위에):
```gradle
android {
    ...

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

### 5-5. AAB 빌드

**Android Studio에서:**
1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** 선택
3. Keystore 경로 및 비밀번호 입력
4. **release** 선택
5. **Finish**

**또는 명령어로:**
```bash
cd android
gradlew bundleRelease
```

생성 위치: `android/app/release/app-release.aab`

## 🚀 6단계: Google Play Console 업로드

1. https://play.google.com/console 접속
2. 개발자 등록 ($25)
3. 새 앱 만들기
4. `app-release.aab` 업로드
5. 스토어 등록정보 작성 (아이콘, 스크린샷, 설명 등)
6. 검토 제출

## 🔄 앱 업데이트 방법

### 웹 컨텐츠 업데이트 (일반적인 경우)
```bash
# Vercel에 배포만 하면 됨
git push

# 앱은 자동으로 새 컨텐츠를 표시함
```

### 앱 버전 업데이트 (네이티브 변경 시)

`android/app/build.gradle`에서 버전 변경:
```gradle
defaultConfig {
    versionCode 2  // 1씩 증가
    versionName "1.1"
}
```

그 후 AAB 재빌드 및 업로드

## 🎯 핵심 포인트

- ✅ **웹뷰 방식**: 앱은 Vercel 웹사이트를 표시만 함
- ✅ **자동 업데이트**: 웹사이트 배포하면 앱도 자동 업데이트
- ✅ **간편한 유지보수**: 네이티브 앱 재빌드 거의 불필요

## ❓ 문제 해결

### Q: 앱이 흰 화면만 보임
- `capacitor.config.ts`의 URL 확인: `https://church-checker.vercel.app`
- `npx cap sync` 재실행

### Q: 빌드 실패
```bash
cd android
gradlew clean
gradlew bundleRelease
```

### Q: Chrome에서 디버깅하려면?
1. USB로 기기 연결
2. Chrome 주소창에 `chrome://inspect` 입력
3. 앱의 WebView 선택

## 📚 더 자세한 가이드

전체 상세 가이드는 [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)를 참고하세요.

---

문의사항이 있으면 언제든 물어보세요! 🎉
