import * as Notifications from "expo-notifications";

let scheduledNotifications = {};

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

  // Cancelar notificaciones previas
  await cancelMedicationNotifications(id);

  const notificationIds = [];

  try {
    // Programar notificación para cada horario
    for (const timeStr of preferred_times) {
      const [hour, minute] = timeStr.split(":").map(Number);

      // Programar la notificación 15 minutos antes
      const trigger = {
        hour: hour,
        minute: Math.max(0, minute - 15),
        repeats: true,
      };

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Hora de tu medicamento",
          body: `${display_name} - ${dose_amount} ${dose_unit}`,
          sound: "default",
          priority: "high",
          data: {
            medicationId: id,
            medicationName: display_name,
            doseAmount: dose_amount,
            doseUnit: dose_unit,
          },
        },
        trigger,
      });

      notificationIds.push(notifId);
    }

    // Guardar IDs para poder cancelarlos después
    scheduledNotifications[id] = notificationIds;
    console.log(`✓ Notificaciones programadas para ${display_name}`);
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

export function formatNextDose(frequencyHours, preferredTimes) {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Encontrar la próxima dosis
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

    // Si pasamos todos los horarios de hoy, la próxima es mañana
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
    // Para otras frecuencias, calcular automáticamente
    const intervalsPerDay = Math.floor(24 / frequencyHours);
    for (let i = 0; i < intervalsPerDay; i++) {
      const hour = (8 + i * frequencyHours) % 24;
      times.push(`${String(hour).padStart(2, "0")}:00`);
    }
  }

  return times;
}
