import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { Ajustes } from './pantallas/Ajustes';
import { Buscar } from './pantallas/Buscar';
import { Ficha } from './pantallas/Ficha';
import { FichaImprimir } from './pantallas/FichaImprimir';
import { MisLeads } from './pantallas/MisLeads';
import { RadarNichos } from './pantallas/RadarNichos';
import { Inteligencia } from './pantallas/Inteligencia';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/negocio/:id/imprimir" element={<FichaImprimir />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/buscar" replace />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/negocio/:id" element={<Ficha />} />
          <Route path="/radar" element={<RadarNichos />} />
          <Route path="/leads" element={<MisLeads />} />
          <Route path="/inteligencia" element={<Inteligencia />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/buscar" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
