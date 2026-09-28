// 驻外薪资换汇计算器 - Background Service Worker (MV3)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[驻外薪资换汇计算器] 扩展安装成功');
  } else if (details.reason === 'update') {
    console.log('[驻外薪资换汇计算器] 扩展已更新至版本 ' + chrome.runtime.getManifest().version);
  }
});
