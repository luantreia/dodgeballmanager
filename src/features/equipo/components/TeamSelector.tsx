import { Listbox, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useEquipo } from '../../../app/providers/EquipoContext';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { Equipo } from '../../../types';

const optionClassName = (active: boolean) =>
  `relative cursor-pointer select-none py-2 pl-10 pr-4 text-sm ${
    active ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
  }`;

const EmptyState = () => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-2 text-sm text-slate-500">
    Sin equipos disponibles
  </div>
);

const TeamSelector = () => {
  const { equipos, equipoSeleccionado, seleccionarEquipo, loading } = useEquipo();

  if (loading) {
    return (
      <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" aria-label="Cargando equipos" />
    );
  }

  if (!equipos.length) {
    return <EmptyState />;
  }

  return (
    <Listbox value={equipoSeleccionado?.id ?? ''} onChange={seleccionarEquipo}>
      <div className="relative mt-1 w-48">
        <Listbox.Button className="relative w-full cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-left text-sm font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
          <span className="block truncate">
            {equipoSeleccionado?.nombre ?? 'Seleccionar equipo'}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
            <ChevronUpDownIcon aria-hidden className="h-5 w-5" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
            {equipos.map((equipo: Equipo) => (
              <Listbox.Option
                key={equipo.id}
                value={equipo.id}
                className={({ active }: { active: boolean }) => optionClassName(active)}
              >
                {({ selected }: { selected: boolean }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                      {equipo.nombre}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600">
                        <CheckIcon aria-hidden className="h-5 w-5" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

export default TeamSelector;
