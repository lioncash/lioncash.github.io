---
title: "Dolphin: Post-5.0 Personal Plans"
---

I'm a maintainer for [Dolphin](https://dolphin-emu.org). There's always something to be done with regards to improving the codebase. Coincidentally, we're currently nearing the end of a feature freeze that was necessary in order to iron out and fix any regressions to get ready for the release of Dolphin 5.0. Due to the length of the feature freeze, it turns out there's actually *a lot* of things that I want to do when it's over. This blog post will lay out some of those things that I want to do with the codebase, or at least work towards achieving after 5.0 is released. I'll also go into why I consider them important.

### Enable more warnings
This one is important (at least to me). Among a host of other things, we currently do not warn about:

- Implicit sign-conversions.
- Left shifts applied to a negative value (this is undefined behavior).
- Null pointer dereferences.
- Type-casts that cast away const (can result in undefined behavior if data is modified).
- Useless casts.

This is terrible for both code review and ensuring correctness in general. Signedness conversions should *always* be explicit in code—especially in an emulator where this sort of thing can cause subtle errors that are very annoying to track down. Some of these errors can be particularly insidious if they happen to only affect a piece of data incorrectly in such a way that it's hardly noticeable until that data has gone through multiple runs of the same operation.

Enabling all warnings is not the goal, since this would border on nonsensical overkill. For example, `-Winline` and `-Wpadded`, are more suited as inspection diagnostics, rather than permanently enabled warnings. However, we really should be more proactive with regards to preventing errors before they actually happen, or at the very least make them more explicit if they exist. Ideally we would have, at minimum, `-Wall` and `-Wextra` enabled for Clang and GCC, and `/W4` for MSVC. This also segues nicely into a slightly controversial topic.

### Avoiding C-style Casts
C-style casts are quick to write and get the job done. However, if you've used C at one point in time, you quickly realize that C's type system is about as sturdy as a stack of saltine crackers and so is its casting mechanism. C-style casts will readily attempt to convert whatever is given to them regardless of what the type is. In fact, C++ defines the C-style cast as applying variations of `const_cast`, `reinterpret_cast`, and `static_cast` and using the first conversion that succeeds, even if it results in ill-formed data (see §5.4 in the C++14 standard). C-style casts also don't provide a lot of second-hand information about what is being converted with the absence of context while C++-style casts, on the other hand, do. C++'s casts are also typically better in terms of triggering warnings that indicate undefined behavior (see `-Wundefined-reinterpret-cast` for Clang).

At bare minimum all pointer casts should be migrated to C++ casts; ideally they'd be removed entirely where applicable, but this needs to be done one step at a time.

### Fix warning-encouraging code
What I mean by this is rectifying parts of our codebase that will almost always cause a conversion or truncation warning to occur in general usage of a certain API or interface. For example, consider the following definition that exists in our codebase as of writing this:

```cpp
void Rumble(u8 pad_num, ControlState strength);
```

`u8` is unnecessary and can simply be `u32` or `unsigned int`. Using types smaller than the size of `int` where they aren't particularly necessary can indirectly lead to quite a bit of truncation warnings due to how integral promotion rules work.

### I'd like to introduce you to my friends: Analyze and Sanitize
I love static analysis. Nothing is better than being called an idiot by a computer—I really do mean that; you can actually learn a lot through the process of inspecting and fixing valid errors that static analyzers report. Given a correct setup, static analysis tools can be quite powerful and useful at tracking down errors in programs, as well as potential invocations of undefined behavior.

Clang and GCC also provide sanitizers for detecting a variety of potential issues in programs, such as:

- ASan — Address sanitizer
- LSan — Leak sanitizer
- MSan — Uninitialized read sanitizer
- TSan — Thread sanitizer
- UBSan — Undefined behavior sanitizer

These sanitizers modify your compiled code to display runtime asserts if they detect anything that goes awry, which is fantastic. Naturally, you may get some false-positives, this is true of any form of analyzer or sanitizer, however the sanitizers supplied with Clang and GCC do a very good job of minimizing that. It's important to note that the sanitizers are not a silver bullet, but they try to get as close as possible to being one. UBSan will not flag every single form of undefined behavior, for example, but it's better than having nothing.

I'd like to explore the possibility of writing tooling that automates the process of checking common codepaths in Dolphin with the sanitizers somehow. I think it would be a neat thing to experiment with.

For other open-source analyzers that aren't related to this, but may be of particular interest to you:

- [cppcheck](https://github.com/danmar/cppcheck/)
- [Frama-C](http://frama-c.com/) (C only)
- [TIS Interpreter](https://github.com/TrustInSoft/tis-interpreter) (C only)

### C++17
C++17 is an update to the C++ programming language that standardizes quite a few new things to the language. Among the new things added, a few stand out:

- [Non-member data(), empty(), and size()](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4280.pdf) — This will allow us to get rid of our `ArraySize` function.
- [clamp()](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/p0025r0.html) — It only took until C++17, but we can finally get rid of our `Clamp` function.
- [Addition of a filesystem library](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3505.html) — We can likely utilize this for our file handling code and get rid of some boilerplate.
- [Parallel versions of standard algorithms](https://isocpp.org/files/papers/P0024R2.html)
- [Fold expressions](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4191.html) — We can use these to simplify some variadic template functions.
- [Library Fundamentals I](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4480.html) — This introduces `std::any`, `std::optional`, and `std::string_view` among other things. `std::optional` can be used to make error handling more straightforward and eliminate cases where we return a boolean from a function to indicate success, and store the actual result in an out parameter.
- [\[\[fallthrough\]\]](https://isocpp.org/files/papers/P0188R1.pdf), [\[\[maybe-unused\]\]](https://isocpp.org/files/papers/P0212R1.pdf), and [\[\[nodiscard\]\]](https://isocpp.org/files/papers/P0189R1.pdf) attributes.

Once C++17 support is relatively in place across the main three compilers that we support (Clang, GCC, and MSVC), we should gradually start moving over to it.

### Consider ways to make VideoCommon less ugly
VideoCommon is our library that contains the graphics API independent code and interfaces that are used to implement a backend. However, I find the way it's set up is kind of ugly due to its reliance on globals, which can be found [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/FramebufferManagerBase.h#L108), [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/PerfQueryBase.h#L69), [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/RenderBase.h#L188), [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/TextureCacheBase.h#L189), [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/VideoConfig.h#L181), and [here](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/VideoCommon/VideoBackendBase.h#L104). There's likely more in other places as well. Even video backends also have some globals. I would like to work towards eliminating these.

On the topic of interfaces, VideoCommon also relies *way* too much on static lifetime variables and static class functions to the point that interfaces actually suffer from it. Some classes actually have to dance around the fact that there's a mishmash of instance variables and static variables at play. I'd like to at least try and rectify some of this.

I do believe VideoCommon can be considerably better than the current state it's in—however, the amount of technical debt it's  showing *needs* to be addressed in some form instead of piling more stuff on top of it all of the time.

### Maybe tone it down a bit on boolean function parameters
This is mostly in JIT code, so it's fairly localized, but is likely present elsewhere in the codebase. Booleans are a great data type. However, what they are not good at is communicating meaning when directly used as a constant. For example, consider the following snippet from Dolphin (`i` is a register index):

```cpp
gpr.BindToRegister(i, false, true);
```

Without looking at the function declaration or definition, you don't really have a clear notion about what the two boolean parameters signify upon first glance. Upon checking the definition we see:

```cpp
void BindToRegister(size_t preg, bool doLoad, bool makeDirty);
```

Now just remember that and make sure not to accidentally transpose arguments when adding new calls of that function to JIT code. Oh, and also make sure to remember what the boolean parameters mean in the other functions that are used in conjunction with `BindToRegister`. This can snowball quite a bit in terms of mental overhead as more functions that do this sort of thing come into play alongside one another.

Ideally, parameters like these should be changed to use strongly-typed enums or, in some cases, be refactored out of the interface altogether. This would also completely eliminate the possibility of accidentally transposing arguments, since the compiler will complain if that mistake is made. Doing this would also make contexts much easier to discern as opposed to constantly flipping back and forth between function declarations and call sites to see which arguments do what. This is somewhat low on my list of things to tackle, but it is still a minor concern.

### Clean up the CMake build scripts
Some of the contents of Dolphin's CMakeLists.txt files used by CMake contain pretty old code in some places; not to mention, the coding style within the files is also inconsistent in some areas. I wouldn't doubt that CMake already does some of the things that are written out long-form in Dolphin's scripts. It couldn't hurt to try and make things a little more organized.

### Conclusion
This is just a small set of things I'd like to do with the codebase. I was initially planning to write a blog post that went more in-depth about other things I consider flaws in Dolphin and how I'd consider fixing them. This would have ranged from the general interface level all the way down to more specific cases of implementation-defined and undefined behavior, however I opted to write a lighter post because I thought it might be boring to most people.

If you actually do want to read a more in-depth article, tell me on IRC or [Twitter](https://twitter.com/Lioncache). If enough people find it interesting, I'll try making another blog post about it at some point.

Anyways, if you made it this far, thanks for reading!

#### Acknowledgements
I'd like to thank [@Veegie_](https://twitter.com/Veegie_) for taking the time to proofread the initial drafts of this blog post for me.
