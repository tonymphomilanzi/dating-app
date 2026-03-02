import Button from "../components/Button.jsx";

export default function MatchSuccess(){
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-6 text-center shadow-card">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-violet-600 text-white shadow-glow">
          <i className="lni lni-heart text-3xl" />
        </div>
        <h1 className="text-2xl font-semibold">It’s a match!</h1>
        <p className="text-gray-600">You both like each other. Start a conversation now.</p>
        <div className="space-y-3">
          <Button className="w-full">Say hello</Button>
          <Button className="w-full btn-outline">Keep swiping</Button>
        </div>
      </div>
    </div>
  );
}