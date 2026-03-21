/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleButtonConfiguration = {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
};

type GoogleInitializeConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void | Promise<void>;
};

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: GoogleInitializeConfiguration) => void;
        renderButton: (element: HTMLElement, config: GoogleButtonConfiguration) => void;
      };
    };
  };
}
