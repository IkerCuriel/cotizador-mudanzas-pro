# Tarifas y criterios del cotizador

> **Histórico desactivado:** el flujo público actual prepara solicitudes sin calcular precios. Estas fórmulas se conservan como referencia del cotizador anterior y no se aplican a las solicitudes. Consulta [el flujo vigente](flujo-solicitudes.md).

Todos los importes se expresan en pesos mexicanos (MXN). Este documento describe la configuración del motor en `src/pricing.js` y distingue las cifras aportadas en el análisis de las decisiones provisionales necesarias para convertirlo en un cálculo funcional.

**Las cifras propuestas no representan tarifas de mercado ni precios ya aprobados por la empresa.** La estimación final debe contrastarse con cotizaciones reales para ajustar los parámetros.

## Procedencia de los valores

| Estado | Significado |
| --- | --- |
| Reportado en el análisis | Precio descrito como vigente en el cotizador de Marco. Se conserva cuando no se propuso un cambio concreto. |
| Propuesto en el análisis | Importe o fórmula que el análisis sugirió explícitamente. Se implementa como propuesta revisable. |
| Provisional de implementación | El análisis pidió considerar el concepto, pero no definió una cifra suficiente. Se asigna un parámetro editable para poder probarlo. |
| Heredado de la aplicación | Cargo que ya tenía esta página y no se discutió en el análisis. Se conserva a la espera de una decisión comercial. |

## Inventario y unidad

El número de artículos es la suma de las cantidades del inventario. El volumen y el peso se calculan multiplicando cada cantidad por su volumen y peso estimados. Una entrada descrita como caja o lote cuenta como una unidad del inventario; no se cuentan individualmente sus contenidos.

Los volúmenes y pesos son referencias, no medidas de una inspección. El catálogo debe ajustarse al inventario habitual de la empresa. Si se conoce el volumen o peso total real, puede capturarse como valor manual para sustituir la estimación correspondiente. Las capacidades siguientes también se deben verificar con la flota real.

| Unidad | Volumen de referencia | Peso de referencia | Banderazo por viaje | Procedencia del banderazo |
| --- | ---: | ---: | ---: | --- |
| Pickup | 4 m³ | 750 kg | $400 | Propuesto en el análisis |
| Van | 10 m³ | 1,200 kg | $600 | Propuesto en el análisis |
| Camión 3.5 t | 22 m³ | 3,500 kg | $800 | Propuesto en el análisis |
| Torton | 50 m³ | 14,000 kg | $1,300 | Propuesto en el análisis |
| Tráiler | 90 m³ | 24,000 kg | $3,500 | Propuesto en el análisis |

**Todas las capacidades de esta tabla son provisionales de implementación.** En modo automático se elige la primera unidad de la tabla que puede transportar tanto el volumen como el peso. También se permite escoger una unidad manualmente.

Cuando la carga supera la capacidad de la unidad seleccionada, se estiman `redondeo hacia arriba(máximo(volumen/capacidad de volumen, peso/capacidad de peso))` viajes. Se usa el tráiler como referencia cuando ninguna unidad puede transportar toda la carga en un viaje. El resumen advierte que operaciones debe validar la unidad, la carga y la ruta; la división por capacidades no determina cómo distribuir piezas indivisibles.

El banderazo y el recorrido se cobran por cada viaje. El inventario y los servicios de carga se calculan una vez para la mudanza completa.

## Tarifa base

Se suman banderazo, volumen, distancia, peso y cantidad de artículos. No se aplican los antiguos cobros de maniobra por tipo de artículo ni un multiplicador de protección.

| Concepto | Regla aplicada | Procedencia |
| --- | --- | --- |
| Banderazo | Precio de la unidad × número de viajes. | Propuesto en el análisis |
| Volumen hasta 35 m³ | $380 por m³. | Reportado en el análisis |
| Volumen que excede 35 m³ | $323 por m³: $380 menos 15%. | Descuento propuesto en el análisis |
| Distancia incluida | Primeros 15 km por viaje. | Umbral reportado en el análisis |
| Distancia adicional local | $35 por km que exceda 15 km, por viaje. | Provisional de implementación; sustituye los $22 reportados |
| Fuera de la ciudad | El cargo por km adicionales se multiplica por 1.35. | Multiplicador provisional de implementación |
| Peso | $0.50 por kg estimado o capturado manualmente. | Provisional de implementación |
| Artículos | $10 por unidad del inventario. | Provisional de implementación |

El multiplicador de fuera de la ciudad se aplica únicamente al cargo de kilómetros adicionales, no al banderazo, al volumen ni a los servicios. La selección local/foránea es explícita: no se deduce de los domicilios. La distancia se captura manualmente y no se calcula una ruta automáticamente.

### Descuento por volumen, con ejemplos

```text
Volumen = mínimo(m³, 35) × $380
        + máximo(m³ − 35, 0) × $323
```

| Volumen | Cálculo del componente de volumen | Importe |
| --- | --- | ---: |
| 35 m³ | 35 × $380 | $13,300 |
| 40 m³ | 35 × $380 + 5 × $323 | $14,915 |

Para 40 m³ el ahorro es $285 respecto a 40 × $380. El descuento no se aplica sobre el total de la mudanza ni sobre los primeros 35 m³. Superar el umbral no reduce el precio de los m³ ya contabilizados.

### Distancia, con ejemplo

Para un viaje de 25 km se cobran 10 km adicionales: $350 en servicio local o $472.50 fuera de la ciudad. El banderazo se agrega por separado. Si se requieren dos viajes, estos cargos por distancia serían $700 y $945, respectivamente.

## Cargos variables

En las fórmulas, `V` representa el volumen total en m³ y `N` la cantidad de artículos del inventario.

| Concepto | Regla aplicada | Procedencia |
| --- | --- | --- |
| Acarreo en origen | `máximo(metros − 30, 0) × ($0.50 × V + $0.15 × N)` | Fórmula provisional de implementación |
| Acarreo en destino | La misma fórmula, usando los metros de destino. | Fórmula provisional de implementación |
| Cargadores extra | `cantidad × ($300 + $2 × V)` | Propuesto en el análisis |
| Casa o bodega | Sin cargo adicional por tipo de inmueble. | Provisional de implementación |
| Departamento | `$4 × V`, por cada extremo que sea departamento. | Provisional de implementación |
| Oficina | `$6 × V`, por cada extremo que sea oficina. | Provisional de implementación |
| Piso sin elevador | `$12 × V × número de pisos`, en cada extremo. | Provisional de implementación |
| Piso con elevador | `$50 × número de pisos`, en cada extremo. | Propuesto en el análisis |
| Embalaje completo | `$95 × V` | Reportado en el análisis |
| Medio embalaje | `$45 × V` | Reportado en el análisis |
| Paquete de 10 cajas | $650 | Reportado en el análisis |
| Paquete de 20 cajas | $1,200 | Reportado en el análisis |
| Paquete de 30 cajas | $1,650 | Reportado en el análisis |
| Desmontaje/montaje | $350 por cada bloque iniciado de 5 muebles seleccionados. | Precio reportado; redondeo por bloque como criterio de implementación |
| Volado de subida | $600 por piso volado. | Provisional de implementación |
| Volado de bajada | $450 por piso volado. | Provisional de implementación |
| Almacenaje | `$12 × volumen a almacenar × días de almacenaje` | Provisional de implementación |

Los 30 metros de acarreo incluidos se aplican de forma independiente en origen y destino. Los pisos se cuentan sobre planta baja; planta baja equivale a cero. Para cada extremo se aplica la tarifa de escaleras o la de elevador según la selección del formulario.

El embalaje completo, el medio embalaje y un paquete de cajas son alternativas excluyentes dentro del cotizador para evitar sumar dos modalidades de embalaje accidentalmente. Los artículos transportados deben registrarse en el inventario también cuando se contrata un paquete de cajas; contratar el servicio no agrega cajas al inventario.

El desmontaje/montaje permanece opcional hasta que la empresa decida si desea incluirlo en la tarifa base. Por ejemplo, de 1 a 5 muebles generan $350 y de 6 a 10 generan $700. No se presupone que todos los muebles del inventario necesitan este servicio.

El volado se suma con los pisos de subida y bajada capturados. En almacenaje se usa el volumen indicado para bodega; si se deja vacío, se usa el volumen total de la mudanza. Se multiplica por los días indicados, sin aplicar el antiguo paquete fijo de 15 días.

## Cargos conservados de la aplicación

Estos cargos no fueron cuantificados en el nuevo análisis y deben confirmarse:

| Concepto | Valor conservado |
| --- | ---: |
| Manejo especial de frágiles, si se selecciona | $420 |
| Fecha de mudanza en sábado o domingo | 8% |
| Servicio prioritario, si se selecciona | 12% |

Los porcentajes de fin de semana y prioridad se calculan sobre la misma suma de tarifa base y cargos variables. Si coinciden, se suman; no se aplica un porcentaje sobre el otro.

## Desglose y rango final

Cada concepto se redondea a centavos y el total se obtiene sumando esas líneas. El resumen separa la tarifa base de los cargos variables y muestra las condiciones que modifican el cálculo.

El rango estimado se presenta así; redondear hacia arriba a $50 conserva el valor cuando ya es múltiplo de $50:

```text
Límite inferior = total redondeado hacia arriba a múltiplos de $50
Límite superior = máximo(límite inferior + $250, total × 1.12)
                 redondeado hacia arriba a múltiplos de $50
```

El rango es una regla de presentación comercial conservada parcialmente de la aplicación anterior y pendiente de validación; no es una medida estadística de incertidumbre. Se eliminó la reducción automática del 6% que antes rebajaba el extremo inferior. No se genera una cotización válida con el inventario vacío.

## Decisiones pendientes de la empresa

1. Confirmar banderazos y capacidades con los vehículos que realmente operan.
2. Validar $35/km y el multiplicador 1.35 con recorridos locales y fuera de la ciudad.
3. Ajustar peso, artículos, acarreo, inmuebles, escaleras, volados y almacenaje usando casos reales.
4. Decidir si el desmontaje/montaje se incluye en el precio base y cuándo procede cobrarlo aparte.
5. Confirmar los cargos heredados y la amplitud del rango final.
6. Definir seguros en una etapa posterior. Esta versión no cobra seguro ni protección adicional y no ofrece una póliza o fondo de emergencias.

El cambio de nombre o URL pública también queda para una etapa posterior; este ajuste del cálculo no lo modifica.
