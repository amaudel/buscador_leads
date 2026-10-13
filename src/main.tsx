import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useAjustes } from './datos/ajustes';
import './estilos.css';

const aplicarTema = () => {
  document.documentElement.dataset.theme = useAjustes.getState().tema;
};
aplicarTema();
useAjustes.subscribe(aplicarTema);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
