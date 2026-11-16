package com.meubolso.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class LembreteReceiver extends BroadcastReceiver {
    private static final String ACAO = "com.meubolso.app.LEMBRETE";
    private static final String CANAL = "lembrete";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ACAO.equals(intent.getAction())) {
            SharedPreferences p = ctx.getSharedPreferences(Dados.PREFS, Context.MODE_PRIVATE);
            String hoje = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            if (p.getBoolean("lemOn", false) && !hoje.equals(p.getString("ultima", ""))) notificar(ctx);
        }
        agendar(ctx); // agenda o próximo (e reagenda depois de reiniciar o celular)
    }

    static void agendar(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(Dados.PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(ctx, LembreteReceiver.class).setAction(ACAO);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (!p.getBoolean("lemOn", false)) return;
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, p.getInt("lemH", 20));
        c.set(Calendar.MINUTE, p.getInt("lemM", 0));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis() + 1000) c.add(Calendar.DAY_OF_MONTH, 1);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), pi);
    }

    private static void notificar(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33
                && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CANAL, "Lembrete diário", NotificationManager.IMPORTANCE_DEFAULT));
        Intent abrir = new Intent(ctx, MainActivity.class).setAction(MainActivity.ACAO_NOVO);
        PendingIntent pi = PendingIntent.getActivity(ctx, 20, abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(ctx, CANAL)
                .setSmallIcon(R.drawable.ic_notif)
                .setColor(0xFF8B5CF6)
                .setContentTitle("Meu Bolso 👛")
                .setContentText("Anotou seus gastos de hoje? Toque para lançar.")
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(1, n);
    }
}
