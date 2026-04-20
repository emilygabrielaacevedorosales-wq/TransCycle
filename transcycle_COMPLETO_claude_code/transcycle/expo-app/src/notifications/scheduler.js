import * as Notifications from "expo-notifications";

let scheduledNotifications = {};
let medicationTimers = {};

export function setupNotificationHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function scheduleDailySymptomReminder() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📋 Registro diario",
        body: "No olvides registrar tus síntomas de hoy",
        priority: "default",
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      },
    });
  } catch (error) {
    console.warn("Error programando recordatorio diario:", error);
  }
}

export async function requestPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.warn("Error solicitando permisos de notificaciones:", error);
    return false;
  }
}

export async function scheduleMedicationNotifications(medication) {
  const { id, display_name, dose_amount, dose_unit, frequency_hours, preferred_times } = medication;

  await cancelMedicationNotifications(id);
  const notificationIds = [];

  try {
    for (const timeStr of preferred_times) {
      const [hour, minute] = timeStr.split(":").map(Number);

      // Notificación 15 minutos antes
      const preNotifTrigger = {
        hour,
        minute: Math.max(0, minute - 15),
        repeats: true,
      };

      const preNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ En 15 minutos",
          body: `${display_name} - ${dose_amount} ${dose_unit}`,
          sound: "default",
          priority: "high",
          data: {
            medicationId: id,
            medicationName: display_name,
            doseAmount: dose_amount,
            doseUnit: dose_unit,
            type: "reminder",
          },
        },
        trigger: preNotifTrigger,
      });

      notificationIds.push(preNotifId);

      // Notificación a la hora exacta
      const timeNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Hora de tu medicamento",
          body: `${display_name} - ${dose_amount} ${dose_unit}. Tienes 30 minutos para tomar.`,
          sound: "default",
          priority: "high",
          data: {
            medicationId: id,
            medicationName: display_name,
            doseAmount: dose_amount,
            doseUnit: dose_unit,
            type: "timeTaken",
            scheduledTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
          },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      notificationIds.push(timeNotifId);

      // Notificación si se pasa la ventana (30 min después)
      const lateNotifTrigger = {
        hour,
        minute: (minute + 30) % 60,
        repeats: true,
      };

      const lateNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Ventana de toma cerrada",
          body: `Pasaron 30 minutos. Próxima dosis será en ${frequency_hours}h.`,
          sound: "default",
          priority: "high",
          data: {
            medicationId: id,
            medicationName: display_name,
            type: "missed",
          },
        },
        trigger: lateNotifTrigger,
      });

      notificationIds.push(lateNotifId);
    }

    scheduledNotifications[id] = notificationIds;
    console.log(`✓ Notificaciones programadas para ${display_name} (2 alerts por horario)`);
  } catch (error) {
    console.warn(`Error programando notificaciones para ${display_name}:`, error);
  }
}

export async function cancelMedicationNotifications(medicationId) {
  try {
    const notifIds = scheduledNotifications[medicationId] || [];
    for (const notifId of notifIds) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
    }
    delete scheduledNotifications[medicationId];
    if (medicationTimers[medicationId]) {
      clearInterval(medicationTimers[medicationId]);
      delete medicationTimers[medicationId];
    }
    console.log(`✓ Notificaciones canceladas para medicamento ${medicationId}`);
  } catch (error) {
    console.warn(`Error cancelando notificaciones:`, error);
  }
}

export async function scheduleAllMedications(medications) {
  for (const med of medications) {
    await scheduleMedicationNotifications(med);
  }
}

export function getMedicationWindowStatus(medication, onStatusChange) {
  const { id, frequency_hours, preferred_times } = medication;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Buscar ventanas activas (dentro de 30 min después de la hora programada)
  let activeWindow = null;
  let minsDiff = null;

  for (const timeStr of preferred_times) {
    const [hour, minute] = timeStr.split(":").map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0);

    const diff = now - scheduledTime;
    const minutesDiff = Math.floor(diff / (1000 * 60));

    // Si está en ventana: 0 a 30 minutos después
    if (minutesDiff >= -15 && minutesDiff <= 30) {
      activeWindow = { hour, minute, minutesDiff };
      minsDiff = minutesDiff;
      break;
    }
  }

  if (!activeWindow) {
    if (medicationTimers[id]) {
      clearInterval(medicationTimers[id]);
      delete medicationTimers[id];
    }
    return { status: "idle", minutesRemaining: null };
  }

  const { minutesDiff: mins } = activeWindow;

  if (mins > 30) {
    return { status: "missed", minutesRemaining: 0 };
  } else if (mins >= 0 && mins <= 30) {
    const remaining = Math.max(0, 30 - mins);

    // Iniciar timer si no existe
    if (!medicationTimers[id] && onStatusChange) {
      medicationTimers[id] = setInterval(() => {
        onStatusChange(getMedicationWindowStatus(medication, onStatusChange));
      }, 1000);
    }

    if (mins < 0) {
      return { status: "warning", minutesRemaining: remaining, isPastTime: true };
    }
    return { status: "active", minutesRemaining: remaining, isPastTime: false };
  }

  return { status: "idle", minutesRemaining: null };
}

export function formatNextDose(frequencyHours, preferredTimes) {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const timeStr of preferredTimes) {
      const [hour, minute] = timeStr.split(":").map(Number);

      if (hour > currentHour || (hour === currentHour && minute > currentMinute)) {
        const nextDose = new Date();
        nextDose.setHours(hour, minute, 0);
        const diff = nextDose - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
          return `próxima dosis en ${hours}h ${mins}m`;
        }
        return `próxima dosis a las ${timeStr}`;
      }
    }

    const firstTime = preferredTimes[0];
    return `próxima dosis mañana a las ${firstTime}`;
  } catch (error) {
    console.warn("Error formateando próxima dosis:", error);
    return "próxima dosis pronto";
  }
}

export function getOptimalTimes(frequencyHours) {
  const times = [];

  if (frequencyHours === 24) {
    times.push("08:00");
  } else if (frequencyHours === 12) {
    times.push("08:00", "20:00");
  } else if (frequencyHours === 8) {
    times.push("08:00", "16:00", "00:00");
  } else {
    const intervalsPerDay = Math.floor(24 / frequencyHours);
    for (let i = 0; i < intervalsPerDay; i++) {
      const hour = (8 + i * frequencyHours) % 24;
      times.push(`${String(hour).padStart(2, "0")}:00`);
    }
  }

  return times;
}
