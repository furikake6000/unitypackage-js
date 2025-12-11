// UnityPackageのimport/export
export {
  importUnityPackage,
  exportUnityPackage,
  type UnityAsset,
  type UnityPackageInfo,
} from './unitypackage';

// TODO: 別のテストが追加されたら削除する
export const hello = () => {
  return 'Hello from unitypackage-js';
};
