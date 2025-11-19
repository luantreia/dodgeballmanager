# ModalGestionAdministradoresEntidad Component

Este componente es un modal reutilizable para gestionar listas de administradores o miembros de cualquier entidad (organizaciones, equipos, jugadores, etc.). Permite ver, agregar nuevos miembros por email y remover miembros existentes.

## Características

- Modal que se abre/cierra basado en la prop `isOpen`
- Formulario para agregar miembros por email
- Lista de miembros actuales con opción de remover
- Funciones genéricas para agregar, obtener y remover miembros
- Callbacks opcionales para manejar eventos de agregar/remover
- Título configurable

## Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `isOpen` | `boolean` | Sí | Controla si el modal está visible |
| `onClose` | `() => void` | Sí | Función para cerrar el modal |
| `entityId` | `string` | Sí | ID de la entidad para la que se gestionan miembros |
| `title` | `string` | No | Título del modal (default: "Administradores") |
| `placeholder` | `string` | No | Placeholder del input de email (default: "email@ejemplo.com") |
| `addButtonText` | `string` | No | Texto del botón de agregar (default: "Agregar") |
| `submittingText` | `string` | No | Texto del botón mientras se envía (default: "Agregando…") |
| `emptyText` | `string` | No | Texto cuando no hay administradores (default: "Sin administradores") |
| `removeButtonText` | `string` | No | Texto del botón de remover (default: "Quitar") |
| `manageButtonText` | `string` | No | Texto del botón de gestionar (default: "Administrar") |
| `addFunction` | `(entityId: string, data: {email: string}) => Promise<void>` | Sí | Función para agregar un miembro |
| `getFunction` | `(entityId: string) => Promise<{administradores: AdminUser[]}>` | Sí | Función para obtener la lista de miembros |
| `removeFunction` | `(entityId: string, adminId: string) => Promise<void>` | Sí | Función para remover un miembro |
| `onAdminAdded` | `(email: string) => void` | No | Callback opcional cuando se agrega un miembro (recibe el email agregado) |
| `onAdminRemoved` | `(adminId: string) => void` | No | Callback opcional cuando se remueve un miembro |

## Tipos

```typescript
interface AdminUser {
  _id: string;
  nombre?: string;
  email?: string;
}
```

## Uso

### Para Organizaciones (ejemplo específico)

```tsx
import { useState } from 'react';
import ModalGestionAdministradoresEntidad from 'shared/components/modalGestionAdministradoresEntidad/ModalGestionAdministradoresEntidad';
import { addOrganizacionAdministrador, getOrganizacionAdministradores, removeOrganizacionAdministrador } from 'features/organizacion/services/organizacionService';

const MiComponente = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const organizationId = 'some-org-id';

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Gestionar Administradores
      </button>
      <ModalGestionAdministradoresEntidad
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityId={organizationId}
        title="Administradores de Organización"
        placeholder="correo@empresa.com"
        addButtonText="Añadir Admin"
        submittingText="Añadiendo…"
        emptyText="No hay administradores asignados"
        removeButtonText="Remover"
        manageButtonText="Administrar"
        addFunction={addOrganizacionAdministrador}
        getFunction={getOrganizacionAdministradores}
        removeFunction={removeOrganizacionAdministrador}
        onAdminAdded={(email) => console.log('Admin agregado:', email)}
        onAdminRemoved={(adminId) => console.log('Admin removido:', adminId)}
      />
    </>
  );
};
```

### Para Otras Entidades (ejemplo genérico)

```tsx
import { useState } from 'react';
import ModalGestionAdministradoresEntidad from 'shared/components/modalGestionAdministradoresEntidad/ModalGestionAdministradoresEntidad';

// Suponiendo que tienes servicios similares para equipos
import { addEquipoMiembro, getEquipoMiembros, removeEquipoMiembro } from 'services/equipoService';

const MiComponenteEquipo = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const equipoId = 'some-equipo-id';

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Gestionar Miembros del Equipo
      </button>
      <ModalGestionAdministradoresEntidad
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityId={equipoId}
        title="Miembros del Equipo"
        addFunction={addEquipoMiembro}
        getFunction={getEquipoMiembros}
        removeFunction={removeEquipoMiembro}
        onAdminAdded={(email) => console.log('Miembro agregado:', email)}
        onAdminRemoved={(adminId) => console.log('Miembro removido:', adminId)}
      />
    </>
  );
};
```

## Notas

- El componente maneja automáticamente la carga de miembros cuando se abre el modal
- Las funciones `addFunction`, `getFunction` y `removeFunction` deben ser proporcionadas por el usuario para adaptarse a la entidad específica
- Utiliza los tipos `AdminUser` para los miembros, pero puede ser extendido si es necesario
- El modal incluye un backdrop que se puede cerrar haciendo clic en la X
- Los estilos están basados en Tailwind CSS y el tema de la aplicación