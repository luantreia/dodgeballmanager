#!/bin/bash

# 🔍 VERIFICACIÓN PASO 2 - COMPONENTES DE SOLICITUDES
# =====================================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Verificando Paso 2: Componentes Reutilizables              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador
TOTAL=0
SUCCESS=0
FAILED=0

# Función para verificar archivo
check_file() {
    local file=$1
    local desc=$2
    ((TOTAL++))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $desc"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}❌${NC} $desc - NO ENCONTRADO"
        ((FAILED++))
        return 1
    fi
}

# Función para verificar contenido en archivo
check_content() {
    local file=$1
    local content=$2
    local desc=$3
    ((TOTAL++))
    
    if grep -q "$content" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $desc"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}❌${NC} $desc"
        ((FAILED++))
        return 1
    fi
}

echo "📁 Verificando archivos creados..."
echo "─────────────────────────────────────────────────────────────────"
echo ""

# Paso 1
echo "Paso 1: SolicitudesProvider"
check_file "src/app/providers/SolicitudesContext.tsx" "SolicitudesContext.tsx"
check_content "src/app/providers/SolicitudesContext.tsx" "export const useSolicitudes" "Hook useSolicitudes exportado"
echo ""

# Paso 2 - Componentes
echo "Paso 2: Componentes Reutilizables"
check_file "src/shared/components/SolicitudModal/SolicitudModal.tsx" "SolicitudModal.tsx"
check_file "src/shared/components/SolicitudButton/SolicitudButton.tsx" "SolicitudButton.tsx"
check_file "src/shared/components/SolicitudNotification/SolicitudNotification.tsx" "SolicitudNotification.tsx"
check_file "src/shared/components/Toast/Toast.tsx" "Toast.tsx"
echo ""

# Services
echo "Services y Tipos"
check_file "src/features/solicitudes/services/solicitudesEdicionService.ts" "solicitudesEdicionService.ts"
check_file "src/types/solicitudesEdicion.ts" "solicitudesEdicion.ts"
echo ""

# Navbar
echo "Integraciones"
check_content "src/app/layout/Navbar.tsx" "SolicitudNotification" "SolicitudNotification en Navbar"
check_content "src/shared/components/index.ts" "SolicitudButton" "SolicitudButton en exports"
echo ""

# Documentación
echo "Documentación"
check_file "PASO2_COMPONENTES.md" "PASO2_COMPONENTES.md"
check_file "PASO3_INTEGRACION_JUGADORES.md" "PASO3_INTEGRACION_JUGADORES.md"
check_file "IMPLEMENTACION_STATUS.md" "IMPLEMENTACION_STATUS.md"
check_file "GUIA_RAPIDA.md" "GUIA_RAPIDA.md"
check_file "PASO2_COMPLETADO.txt" "PASO2_COMPLETADO.txt"
echo ""

# Resumen
echo "─────────────────────────────────────────────────────────────────"
echo ""
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "─────────────────────────────────────────────────────────────────"
echo -e "Total de chequeos:  ${YELLOW}$TOTAL${NC}"
echo -e "Exitosos:          ${GREEN}$SUCCESS${NC}"
echo -e "Fallidos:          ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ PASO 2 COMPLETADO CORRECTAMENTE${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Ejecutar: npm run type-check  (verificar tipos)"
    echo "2. Ejecutar: npm run lint        (verificar código)"
    echo "3. Ejecutar: npm run build       (compilar)"
    echo "4. Proceder a Paso 3: Integración en JugadoresPage"
    exit 0
else
    echo -e "${RED}⚠️  FALTAN ARCHIVOS${NC}"
    echo ""
    echo "Verifica que:"
    echo "• Los archivos están en las rutas correctas"
    echo "• Los permisos de archivo son correctos"
    echo "• No hay caracteres especiales en los nombres"
    exit 1
fi
