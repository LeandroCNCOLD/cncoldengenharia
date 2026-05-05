// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNumericInput } from "../useNumericInput";

describe("useNumericInput", () => {
  it("retorna string vazia quando value é undefined", () => {
    const { result } = renderHook(() => useNumericInput(undefined, vi.fn()));
    expect(result.current.value).toBe("");
  });

  it("retorna string do número quando value é finito", () => {
    const { result } = renderHook(() => useNumericInput(7455, vi.fn()));
    expect(result.current.value).toBe("7455");
  });

  it("aceita sinal negativo sozinho sem chamar onCommit", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useNumericInput(0, onCommit));
    act(() => {
      result.current.onChange({ target: { value: "-" } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.value).toBe("-");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("aceita número negativo completo e chama onCommit", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useNumericInput(0, onCommit));
    act(() => {
      result.current.onChange({ target: { value: "-18" } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.value).toBe("-18");
    expect(onCommit).toHaveBeenCalledWith(-18);
  });

  it("aceita número grande (7455) sem bloquear", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useNumericInput(0, onCommit));
    act(() => {
      result.current.onChange({ target: { value: "7455" } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.value).toBe("7455");
    expect(onCommit).toHaveBeenCalledWith(7455);
  });

  it("aceita decimal em construção '0.0' sem bloquear", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useNumericInput(0, onCommit));
    act(() => {
      result.current.onChange({ target: { value: "0.0" } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.value).toBe("0.0");
  });

  it("aplica clamp no onBlur quando min/max definidos", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useNumericInput(50, onCommit, { min: 0, max: 100 }));
    act(() => {
      result.current.onChange({ target: { value: "150" } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => { result.current.onBlur(); });
    expect(onCommit).toHaveBeenLastCalledWith(100);
  });

  it("sincroniza com valor externo quando muda", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useNumericInput(v, onCommit),
      { initialProps: { v: 100 } }
    );
    expect(result.current.value).toBe("100");
    rerender({ v: 200 });
    expect(result.current.value).toBe("200");
  });
});
