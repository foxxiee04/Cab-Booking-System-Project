declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_API_URL?: string;
    REACT_APP_SOCKET_URL?: string;
    REACT_APP_GOOGLE_MAPS_API_KEY?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};