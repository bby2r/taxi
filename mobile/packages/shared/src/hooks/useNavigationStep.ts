import { useEffect, useMemo, useRef, useState } from 'react';
import { Route, RoutePoint, RouteStep } from '../api/routing';
import { haversineMeters } from '../utils/geo';

// Внутри этого радиуса считаем что водитель «прошёл» манёвр и
// переключаемся на следующий шаг. 30м — компромисс: меньше — шаг не
// переключается на пересечении (водитель уже за поворотом, а баннер
// всё ещё командует поворачивать), больше — переключение происходит
// слишком рано.
const MANEUVER_PASSED_RADIUS_M = 30;

// Когда показывать «приготовьтесь / через 200 м» голосом. Заранее, не
// в момент манёвра.
const PRE_ANNOUNCE_M = 200;

interface NavigationCue {
  step: RouteStep;
  distanceMeters: number; // до манёвра
}

interface UseNavigationStepResult {
  current: NavigationCue | null;
  // Шаги через которые мы уже прошли — не показываем их в баннере.
  // Возвращаем сюда индекс «активного» шага относительно route.steps.
  activeIndex: number;
  // Текст подсказки для голосового объявления, выставляется когда
  // расстояние пересекает PRE_ANNOUNCE_M в первый раз для этого шага.
  // Hook сбрасывает в null после прочтения родителем.
  voiceCue: string | null;
  consumeVoiceCue: () => void;
}

export function useNavigationStep(
  route: Route | null,
  driverPosition: RoutePoint | null,
): UseNavigationStepResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const [voiceCue, setVoiceCue] = useState<string | null>(null);
  // Чтобы голос не повторял одно и то же на каждом GPS-тике, помечаем
  // шаги по индексу как «уже объявленные». Сбрасывается при смене route.
  const announcedRef = useRef<Set<number>>(new Set());

  // Сброс при новом маршруте — все шаги снова в pending.
  useEffect(() => {
    setActiveIndex(0);
    setVoiceCue(null);
    announcedRef.current = new Set();
  }, [route]);

  // Подбираем активный шаг + расстояние до его манёвра.
  const current = useMemo<NavigationCue | null>(() => {
    if (!route || !driverPosition || route.steps.length === 0) {
      return null;
    }
    const step = route.steps[activeIndex];
    if (!step) return null;
    const dist = haversineMeters(driverPosition, step.location);
    return { step, distanceMeters: dist };
  }, [route, driverPosition, activeIndex]);

  // Логика переключения шагов: если водитель в радиусе 30м от точки
  // манёвра — считаем что прошли, переключаем на следующий.
  useEffect(() => {
    if (!current) return;
    if (current.distanceMeters > MANEUVER_PASSED_RADIUS_M) return;
    if (!route) return;
    if (activeIndex >= route.steps.length - 1) return;
    setActiveIndex((idx) => idx + 1);
  }, [current, route, activeIndex]);

  // Голосовое объявление за PRE_ANNOUNCE_M до манёвра — один раз на шаг.
  useEffect(() => {
    if (!current) return;
    if (announcedRef.current.has(activeIndex)) return;
    if (current.distanceMeters > PRE_ANNOUNCE_M) return;
    if (current.distanceMeters < MANEUVER_PASSED_RADIUS_M) return;
    const rounded = Math.round(current.distanceMeters / 50) * 50;
    const prefix = rounded > 0 ? `Через ${rounded} метров. ` : '';
    setVoiceCue(prefix + current.step.instruction);
    announcedRef.current.add(activeIndex);
  }, [current, activeIndex]);

  const consumeVoiceCue = (): void => setVoiceCue(null);

  return {
    current,
    activeIndex,
    voiceCue,
    consumeVoiceCue,
  };
}
