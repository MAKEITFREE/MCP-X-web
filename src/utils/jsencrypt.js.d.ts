declare module 'jsencrypt/bin/jsencrypt.min' {
  export default class JSEncrypt {
    constructor();
    setPublicKey(key: string): void;
    setPrivateKey(key: string): void;
    encrypt(text: string): string | false;
    decrypt(text: string): string | false;
  }
}

export function encrypt(txt: string): string | false;
export function decrypt(txt: string): string | false; 