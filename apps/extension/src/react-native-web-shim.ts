export * from 'react-native-web';
export { default } from 'react-native-web';

export const TurboModuleRegistry = {
  getEnforcing: (name: string) => {
    throw new Error(`TurboModule ${name} is not available in the web build.`);
  },
};
