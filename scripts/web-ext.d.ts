declare module 'web-ext' {
  interface SignOptions {
    sourceDir: string;
    artifactsDir: string;
    apiKey: string;
    apiSecret: string;
    amoBaseUrl?: string;
    channel: 'listed' | 'unlisted';
    uploadSourceCode?: string;
  }
  const webExt: { cmd: { sign(options: SignOptions): Promise<unknown> } };
  export default webExt;
}
