package com.meubolso.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class WidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        atualizar(ctx);
    }

    static void atualizar(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        SharedPreferences p = ctx.getSharedPreferences(Dados.PREFS, Context.MODE_PRIVATE);
        boolean lock = p.getBoolean("lock", false);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        rv.setTextViewText(R.id.w_saldo, lock ? "R$ •••••" : p.getString("saldo", "R$ 0,00"));
        rv.setTextViewText(R.id.w_sub, lock ? "🔒 Toque para abrir" : p.getString("sub", "Toque no + para lançar"));
        rv.setInt(R.id.w_root, "setBackgroundResource",
                !lock && p.getBoolean("neg", false) ? R.drawable.widget_neg : R.drawable.widget_pos);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent abrir = new Intent(ctx, MainActivity.class);
        rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 10, abrir, flags));
        Intent novo = new Intent(ctx, MainActivity.class).setAction(MainActivity.ACAO_NOVO);
        rv.setOnClickPendingIntent(R.id.w_mais, PendingIntent.getActivity(ctx, 11, novo, flags));
        mgr.updateAppWidget(ids, rv);
    }
}
