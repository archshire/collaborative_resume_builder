interface ImportMetaEnv {
  readonly VITE_DEMO_LOGIN_USER?: string;
  readonly VITE_DEMO_LOGIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
