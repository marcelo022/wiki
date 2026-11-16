package com.meubolso.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    static final String ACAO_NOVO = "com.meubolso.app.NOVO";
    private static final int REQ_SALVAR = 1, REQ_ABRIR = 2, REQ_FOTO = 3, REQ_NOTIF = 4;

    private WebView web;
    private volatile boolean autenticando = false;
    private boolean emOutraTela = false, paginaPronta = false, novoPendente = false;
    private long pausadoEm = 0;
    private String conteudoParaSalvar;
    private ValueCallback<Uri[]> fotoCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0F172A);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                paginaPronta = true;
                if (novoPendente) {
                    novoPendente = false;
                    js("window.novoPeloWidget && window.novoPeloWidget()");
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fotoCallback != null) fotoCallback.onReceiveValue(null);
                fotoCallback = cb;
                abrirEscolhaDeFoto();
                return true;
            }
        });
        web.addJavascriptInterface(new Ponte(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        tratarIntent(getIntent());
    }

    private void js(String codigo) {
        web.evaluateJavascript(codigo, null);
    }

    private void tratarIntent(Intent i) {
        if (i != null && ACAO_NOVO.equals(i.getAction())) {
            if (paginaPronta) js("window.novoPeloWidget && window.novoPeloWidget()");
            else novoPendente = true;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        tratarIntent(intent);
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausadoEm = SystemClock.elapsedRealtime();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pausadoEm > 0 && paginaPronta) {
            boolean trancar = !autenticando && !emOutraTela && SystemClock.elapsedRealtime() - pausadoEm > 15000;
            js("window.aoVoltar && window.aoVoltar(" + trancar + ")");
        }
        emOutraTela = false;
        pausadoEm = 0;
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.voltar && window.voltar()", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    // ---------- foto do comprovante ----------
    private void abrirEscolhaDeFoto() {
        Intent galeria = new Intent(Intent.ACTION_GET_CONTENT);
        galeria.addCategory(Intent.CATEGORY_OPENABLE);
        galeria.setType("image/*");
        Intent escolha = Intent.createChooser(galeria, "Comprovante");
        File cam = FotoProvider.arquivoCamera(this);
        cam.delete();
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) != null) {
            camera.putExtra(MediaStore.EXTRA_OUTPUT, FotoProvider.URI_CAMERA);
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            for (android.content.pm.ResolveInfo ri : getPackageManager().queryIntentActivities(camera, 0)) {
                grantUriPermission(ri.activityInfo.packageName, FotoProvider.URI_CAMERA,
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            escolha.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        emOutraTela = true;
        try {
            startActivityForResult(escolha, REQ_FOTO);
        } catch (Exception e) {
            emOutraTela = false;
            fotoCallback.onReceiveValue(null);
            fotoCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FOTO) {
            if (fotoCallback == null) return;
            Uri[] resultado = null;
            if (res == RESULT_OK) {
                if (data != null && data.getData() != null) resultado = new Uri[]{data.getData()};
                else if (FotoProvider.arquivoCamera(this).length() > 0) resultado = new Uri[]{FotoProvider.URI_CAMERA};
            }
            fotoCallback.onReceiveValue(resultado);
            fotoCallback = null;
        } else if (req == REQ_SALVAR) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && conteudoParaSalvar != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    os.write(conteudoParaSalvar.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception ignored) {
                }
            }
            conteudoParaSalvar = null;
            if (res == RESULT_OK) js("window.arquivoSalvo && window.arquivoSalvo(" + ok + ")");
        } else if (req == REQ_ABRIR && res == RESULT_OK && data != null && data.getData() != null) {
            try (InputStream is = getContentResolver().openInputStream(data.getData())) {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                String txt = new String(bos.toByteArray(), StandardCharsets.UTF_8);
                js("window.arquivoAberto && window.arquivoAberto(" + JSONObject.quote(txt) + ")");
            } catch (Exception e) {
                js("window.arquivoAberto && window.arquivoAberto('')");
            }
        }
    }

    // ---------- digital ----------
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
                js("window.liberar && window.liberar()");
            }

            @Override
            public void onAuthenticationError(int code, CharSequence msg) {
                autenticando = false;
            }
        });
    }

    private File pastaFotos() {
        File d = new File(getFilesDir(), "fotos");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static String idSeguro(String id) {
        return id.replaceAll("[^0-9A-Za-z_-]", "");
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

        /** Resumo enviado pela página: alimenta o widget e o lembrete. */
        @JavascriptInterface
        public void sincronizar(String json) {
            try {
                JSONObject o = new JSONObject(json);
                getSharedPreferences(Dados.PREFS, MODE_PRIVATE).edit()
                        .putString("saldo", o.optString("saldo"))
                        .putString("sub", o.optString("sub"))
                        .putBoolean("neg", o.optBoolean("neg"))
                        .putBoolean("lock", o.optBoolean("lock"))
                        .putString("ultima", o.optString("ultima"))
                        .putBoolean("lemOn", o.optBoolean("lemOn"))
                        .putInt("lemH", o.optInt("lemH", 20))
                        .putInt("lemM", o.optInt("lemM", 0))
                        .apply();
                WidgetProvider.atualizar(MainActivity.this);
                LembreteReceiver.agendar(MainActivity.this);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void pedirNotificacao() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
            }
        }

        @JavascriptInterface
        public void salvarArquivo(String nome, String mime, String conteudo) {
            runOnUiThread(() -> {
                conteudoParaSalvar = conteudo;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime);
                i.putExtra(Intent.EXTRA_TITLE, nome);
                emOutraTela = true;
                startActivityForResult(i, REQ_SALVAR);
            });
        }

        @JavascriptInterface
        public void abrirArquivo() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                emOutraTela = true;
                startActivityForResult(i, REQ_ABRIR);
            });
        }

        @JavascriptInterface
        public boolean salvarFoto(String id, String dataUrl) {
            try {
                String b64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                try (FileOutputStream fos = new FileOutputStream(new File(pastaFotos(), idSeguro(id) + ".jpg"))) {
                    fos.write(bytes);
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String lerFoto(String id) {
            File f = new File(pastaFotos(), idSeguro(id) + ".jpg");
            if (!f.exists()) return "";
            try (FileInputStream fis = new FileInputStream(f)) {
                byte[] b = new byte[(int) f.length()];
                int lido = 0;
                while (lido < b.length) {
                    int n = fis.read(b, lido, b.length - lido);
                    if (n < 0) break;
                    lido += n;
                }
                return "data:image/jpeg;base64," + Base64.encodeToString(b, Base64.NO_WRAP);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void apagarFoto(String id) {
            new File(pastaFotos(), idSeguro(id) + ".jpg").delete();
        }
    }
}
