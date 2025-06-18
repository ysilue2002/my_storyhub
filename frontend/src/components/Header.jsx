export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-700">MyStoryHub</h1>
        <nav className="space-x-6 hidden md:flex">
          <a href="#" className="hover:text-indigo-600">Accueil</a>
          <a href="#" className="hover:text-indigo-600">À propos</a>
          <a href="#" className="hover:text-indigo-600">Contact</a>
        </nav>
        <button className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-600 transition">
          Connexion
        </button>
      </div>
    </header>
  );
}