/* Conexion a Supabase.

   Estas dos claves son publicas por diseno: la clave anon solo permite
   lo que dejen las politicas RLS del esquema (sql/schema.sql), que
   limitan cada fila a su dueno. Por eso puede vivir en el repositorio.

   Mientras esto no se rellene la app funciona igual, guardando en el
   navegador; al configurarlo, sincroniza entre dispositivos. */

var CONFIG = {
  SUPABASE_URL: "https://aadnukimvyhoinhbwqls.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhZG51a2ltdnlob2luaGJ3cWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODY0NDMsImV4cCI6MjEwMzU2MjQ0M30.6TVIu-EWwyeZQuvF3nNO5lj-XDRInUGjNJVDBcndeAY"
};
