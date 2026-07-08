"use client";

import Button from "@/components/Button";
import { useState } from "react";

function Test() {
  const [names, setNames] = useState(["Ahmed", "Sameeha", "Lyall", "Anas"]);
  return (
    <div className="p-4 m-8 bg-arcade-card">
      <h3>Site Made By:</h3>
      <ul className="pt-2 pb-8">
        {names.map((name, index) => {
          return <li key={name}>{name}</li>;
        })}
      </ul>
      <Button
        onClick={() => {
          setNames(names.filter((name) => name !== "Sameeha"));
        }}
      >
        Delete Traitors
      </Button>
    </div>
  );
}
export default Test;
