import React, { createContext, useContext } from 'react';

const ZoomContext = createContext(1);

export const ZoomProvider = ZoomContext.Provider;
export const useZoom = () => useContext(ZoomContext);
