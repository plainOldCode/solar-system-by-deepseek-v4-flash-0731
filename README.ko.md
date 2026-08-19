# DS4 Solar System

**Vite, TypeScript, Three.js**로 구현한 인터랙티브 3D 태양계 시각화 프로젝트입니다. 실제 천문 데이터를 기반으로 태양부터 명왕성, 주요 위성 25개까지 표현하며, 전체 태양계를 한 화면에서 이해할 수 있도록 거리와 천체 크기에 서로 독립적인 로그 기반 시각화 스케일을 적용합니다.

**English 문서:** [README.md](README.md)

## 사용한 원본 프롬프트

이 프로젝트는 다음 구현 프롬프트를 사용해 개발했습니다.

[Three.js Logarithmic Solar System — implementation prompt](https://gist.github.com/plainOldCode/fb2e3ea48caada23107704628c2a9384)

## 주요 기능

- 태양, 8개 행성, 명왕성, 주요 위성 25개 포함
- NASA/JPL 기반 반지름, 궤도 거리, 공전/자전 주기, 이심률, 궤도 경사, 부모 천체 데이터
- 로그 기반 태양 중심 거리 매핑과 독립적인 천체 반지름 매핑
- 일반적인 태양계 관찰 방식에 맞춘 수평형 기본 orbital plane 구성
- 3D orbital inclination이 보이는 궤도 표현
- 실제 공전 주기 비율을 유지하는 시간 기반 궤도 시뮬레이션
- 자체 발광 태양, 토성 고리, 행성 조명
- Three.js `OrbitControls`를 이용한 회전/이동/확대·축소
- orbit line보다 천체 mesh를 우선하는 deterministic body selection
- 행성, 명왕성, 주요 위성 camera focus
- 한국어 우선 라벨과 영어 보조 이름
- 접근성 있는 HUD와 전체 **Hide Panels / Show Panels** 기능
- 데스크톱·모바일 responsive layout 및 touch control
- 외부 texture 다운로드 없이 동작하는 procedural material과 local asset

## 빠른 시작

필요 환경: Node.js 18 이상, npm

```bash
npm install
npm run dev
```

Vite가 출력하는 URL을 엽니다. 기본 주소는 보통 `http://localhost:5173/`입니다.

## 명령어

| 명령어 | 목적 |
|---|---|
| `npm run dev` | hot reload 개발 서버 실행 |
| `npm run typecheck` | strict TypeScript 검사 |
| `npm test` | Vitest 테스트 실행 |
| `npm run test:watch` | Vitest watch mode 실행 |
| `npm run build` | typecheck 및 `dist/` production build 생성 |
| `npm run preview` | production build 로컬 실행 |

## 조작법

### 마우스와 터치

- 왼쪽 드래그: 카메라 회전
- 휠 또는 pinch: 확대·축소
- 오른쪽 드래그 또는 두 손가락 드래그: 이동
- 천체 클릭: 선택 및 focus
- 빈 공간 클릭: 선택 해제

### 키보드

- 방향키: 천체 선택 순회
- Space: 시뮬레이션 재생/일시정지
- Escape: 선택 해제 및 홈 화면
- Tab: 접근 가능한 control 이동
- 패널 toggle에서 Enter/Space: HUD 숨김/복원

### HUD control

- 시뮬레이션 재생/일시정지
- 시뮬레이션 속도 증가/감소
- 시뮬레이션 시간과 속도 초기화
- 장면 내 라벨 표시/숨김
- 이전/다음 천체 이동 또는 body selector 사용
- 태양 중심 home view 복귀
- 전체 HUD와 장면 내 라벨 Hide/Show

기본 시뮬레이션 속도는 행성 이동을 관찰하기 쉽도록 의도적으로 느리게 설정되어 있습니다(`0.1 simulated day/second`). 천체 사이의 실제 공전 주기 비율은 유지됩니다.

## 시각화 스케일

실제 천문 값은 data model에 보존하고, 렌더링 거리와 렌더링 천체 크기는 서로 독립적으로 계산합니다.

### 태양 중심 거리

기본 거리 매핑은 로그 방식입니다.

```text
sceneDistance = distanceGain * log10(1 + distanceKm / distanceFloorKm)
```

행성의 거리 순서와 넓은 상대 차이는 보존하면서 수성부터 명왕성까지 초기 화면에 배치할 수 있도록 압축합니다.

### 천체 반지름

천체 크기도 별도의 압축 로그 매핑을 사용합니다.

```text
sceneRadius = clamp(
  sunSceneRadius * (
    log1p(radiusKm) / log1p(sunRadiusKm)
  ) ** radiusCompression,
  minSceneRadius,
  maxSceneRadius
)
```

태양은 자체 발광 material을 사용해 가장 밝게 보입니다. 행성과 위성은 실제 크기 순서를 유지하면서도 인접 궤도를 가리지 않도록 compact하게 표시됩니다.

> 이 시각화는 실제 천문 데이터를 사용합니다. 그러나 궤도 거리는 로그 방식으로 압축하고 천체 크기는 가시성을 위해 조정합니다. 따라서 렌더링 거리와 렌더링 크기는 하나의 동일한 물리 스케일을 공유하지 않습니다.

## 데이터와 출처

데이터셋은 `src/data/solarSystemData.ts`에 있으며 렌더링 코드와 분리되어 있습니다. 총 35개 천체로, 태양 1개, 행성 8개, 명왕성 1개, 주요 위성 25개를 포함합니다.

주요 공개 출처:

- [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)
- [NASA/JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/)
- [JPL Planetary Satellite Physical Parameters](https://ssd.jpl.nasa.gov/sats/phys_par/)

단위는 명시적으로 관리합니다. 반지름과 위성 거리는 km, 태양 중심 반장축은 AU, 경사와 tilt는 degree, 공전·자전 주기는 day/hour를 사용합니다.

## 프로젝트 구조

```text
src/
  main.ts
  styles.css
  data/
    types.ts
    solarSystemData.ts
    validate.ts
  core/
    CameraRig.ts
    CelestialBody.ts
    OrbitRenderer.ts
    ScaleManager.ts
    SimulationClock.ts
    SolarSystem.ts
    orbit.ts
  ui/
    AppController.ts
    ControlPanel.ts
    InfoPanel.ts
    Labels.ts
    hudVisibility.ts
    selectionModel.ts
    format.ts
```

- `data/`: 천문 데이터, type, 출처, validation
- `core/`: scale, orbital math, simulation clock, scene graph, camera, resource disposal
- `ui/`: selection, label, info panel, control, 접근성, HUD visibility

## 검증 결과

최신 검증은 데스크톱과 모바일 viewport에서 Chromium/SwiftShader WebGL runtime으로 수행했습니다.

- Typecheck: 통과
- Production build: 통과
- Vitest: **95/95 통과**
- 데스크톱·모바일 body selection: 통과
- Earth/Venus selection identity regression: 통과
- Pluto/Charon/Titan 등 위성 선택: 통과
- 태양 자체 발광 렌더링: 통과
- 수평형 orbital composition: 통과
- Hide/Show Panels keyboard 복구: 통과
- console/page error: 검증 run에서 0건
- Git working tree: clean

최신 selection/size 수정은 `3228e23`, 태양 발광 수정은 `fa6a673` commit에 기록되어 있습니다.

## 알려진 제한사항

- 기본 UI는 로그 시각화 모드를 중심으로 제공하며, 대체 scale mode는 내부 API로 구현되어 있지만 완전한 사용자용 scale editor는 아닙니다.
- procedural star-field 밀도와 일부 행성 surface detail은 브라우저 성능을 위해 가볍게 구현했습니다.
- 이 프로젝트는 교육용 시각화이며 고정밀 ephemeris나 물리 엔진이 아닙니다.

## 라이선스

아직 라이선스를 선택하지 않았습니다. 이 repository를 공개 배포하기 전에 적절한 라이선스를 추가하세요.
