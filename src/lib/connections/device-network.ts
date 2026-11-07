export const subscribeDeviceNetwork = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

export const deviceOnline = () => navigator.onLine;

export const deviceOnlineOnServer = () => true;
