package com.meubolso.app;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;
    private volatile boolean autenticando = false;
    private long pausadoEm = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0F172A);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Ponte(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausadoEm = SystemClock.elapsedRealtime();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Trava de novo se o app ficou mais de 15 s em segundo plano
        if (pausadoEm > 0 && !autenticando && SystemClock.elapsedRealtime() - pausadoEm > 15000) {
            web.evaluateJavascript("window.travar && window.travar()", null);
        }
        pausadoEm = 0;
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.voltar && window.voltar()", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    private void pedirDigital() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return;
        autenticando = true;
        BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                .setTitle("Meu Bolso")
                .setSubtitle("Use sua digital para entrar")
                .setNegativeButton("Usar senha", getMainExecutor(), (d, w) -> autenticando = false)
                .build();
        prompt.authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                autenticando = false;
                web.evaluateJavascript("window.liberar && window.liberar()", null);
            }

            @Override
            public void onAuthenticationError(int code, CharSequence msg) {
                autenticando = false;
            }
        });
    }

    private class Ponte {
        @JavascriptInterface
        public boolean temDigital() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                BiometricManager bm = getSystemService(BiometricManager.class);
                return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
            }
            return false;
        }

        @JavascriptInterface
        public void digital() {
            runOnUiThread(MainActivity.this::pedirDigital);
        }

        @JavascriptInterface
        public void barra(String cor, boolean claro) {
            runOnUiThread(() -> {
                int c = Color.parseColor(cor);
                getWindow().setStatusBarColor(c);
                getWindow().setNavigationBarColor(c);
                web.setBackgroundColor(c);
                View d = getWindow().getDecorView();
                int f = d.getSystemUiVisibility();
                int luz = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                d.setSystemUiVisibility(claro ? (f | luz) : (f & ~luz));
            });
        }
    }
}
